import { Router, Request, Response, type CookieOptions } from 'express';
import { PrismaClient, Provider, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { publishRecurringJob } from '../lib/rabbit';
import { validate } from '../middlewares/validation';
import { registerSchema, loginSchema, googleLoginSchema, googleResolveConflictSchema, linkGoogleSchema } from '../schemas/auth.schema';
import rateLimit from 'express-rate-limit';
import { authenticate, type AuthenticatedRequest } from '../middlewares/auth';
import { mergeUsersUsingGoogleAsCanonical } from '../services/userMerge';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

class GoogleTokenError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Limitar POST /auth/google para 5 requisições por minuto por IP
const googleAuthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // 5 requisições por janela por IP
  handler: (req, res) => {
    res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente mais tarde.' });
  }
});

const getJwtSecret = (): string => config.jwtSecret;

/**
 * Remove campos sensíveis do objeto user antes de enviar ao cliente
 * 
 * @param user - Objeto user do Prisma
 * @returns User sem passwordHash e outros campos internos
 */
type PrismaUser = Pick<User, 'id' | 'email' | 'name' | 'avatar' | 'provider' | 'googleId' | 'passwordHash'>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const sanitizeUser = (user: PrismaUser) => ({
  id: user.id,
  email: user.email,
  name: user.name ?? null,
  avatar: user.avatar ?? null,
  provider: user.provider ?? Provider.LOCAL,
  googleLinked: Boolean(user.googleId),
});

const buildRefreshTokenCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: '/',
  ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
});

const buildRefreshTokenClearOptions = (): CookieOptions => {
  const { maxAge, ...rest } = buildRefreshTokenCookieOptions();
  return rest;
};

const buildBaseClaims = (user: PrismaUser) => ({
  sub: user.id,
  email: user.email,
  provider: user.provider ?? Provider.LOCAL,
  googleLinked: Boolean(user.googleId),
});

const generateAccessToken = (user: PrismaUser): string => {
  return jwt.sign({ ...buildBaseClaims(user), tokenType: 'access' }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

const generateRefreshToken = (user: PrismaUser): string => {
  return jwt.sign({ ...buildBaseClaims(user), tokenType: 'refresh' }, getJwtSecret(), { expiresIn: '7d' });
};

const issueSession = (res: Response, user: PrismaUser, status = 200) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.cookie('refreshToken', refreshToken, buildRefreshTokenCookieOptions());
  return res.status(status).json({
    user: sanitizeUser(user),
    accessToken,
  });
};

const logAuthEvent = (event: string, meta: Record<string, unknown> = {}) => {
  console.info(`[AUTH] ${event}`, meta);
};

export default function authRoutes(prisma: PrismaClient) {
  const router = Router();

  // Google OAuth2 client (used to validate ID tokens sent by frontend)
  const googleClient = new OAuth2Client(config.googleClientId);

  const verifyGoogleCredential = async (credential: string) => {
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    } catch (verifyError) {
      console.warn('[AUTH] Google token verification failed:', verifyError);
      throw new GoogleTokenError(401, 'INVALID_GOOGLE_TOKEN', 'Token inválido.');
    }

    const payload = ticket.getPayload();

    if (!payload) {
      throw new GoogleTokenError(401, 'INVALID_GOOGLE_TOKEN', 'Token inválido.');
    }

    const email = payload.email;
    const rawEmailVerified = payload.email_verified as unknown;
    const emailVerified =
      rawEmailVerified === true ||
      (typeof rawEmailVerified === 'string' && rawEmailVerified.toLowerCase() === 'true');
    const googleId = payload.sub;
    const name = payload.name ?? undefined;
    const avatar = payload.picture ?? undefined;

    if (!email || !googleId) {
      throw new GoogleTokenError(400, 'INVALID_GOOGLE_PAYLOAD', 'Payload incompleto.');
    }

    if (!emailVerified) {
      throw new GoogleTokenError(400, 'EMAIL_NOT_VERIFIED', 'Email não verificado pelo provedor.');
    }

    return { email, googleId, name, avatar };
  };

  // ==========================================================================
  // POST /api/auth/register - Registro de novo usuário
  // ==========================================================================
  /**
   * Cria novo usuário e retorna access token + define refresh token em cookie httpOnly
   * 
   * Fluxo:
   * 1. Valida payload (Zod middleware já aplicado)
   * 2. Verifica se e-mail já existe (retorna 409 se duplicado)
   * 3. Hash da senha com bcrypt (custo 10)
   * 4. Cria usuário no banco
   * 5. Gera access token (15min) e refresh token (7d)
   * 6. Define refresh token como cookie httpOnly
   * 7. Retorna access token no corpo + dados do usuário
   * 
   * Segurança:
   * - Senha nunca retornada
   * - Refresh token apenas em cookie (inacessível por JS)
   * - Access token apenas em memória no frontend
   */
  router.post('/register', validate({ body: registerSchema }), async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      const normalizedEmail = normalizeEmail(email);

      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      if (existingUser) {
        if (existingUser.provider === Provider.LOCAL) {
          return res.status(409).json({
            error: 'DUPLICATE_USER',
            message: 'E-mail já está em uso por uma conta local.',
          });
        }
        return res.status(409).json({
          error: 'GOOGLE_ACCOUNT_EXISTS',
          message: 'Já existe conta com Google para este e-mail. Entre com Google e use o fluxo de vínculo.',
        });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name,
          provider: Provider.LOCAL,
          googleId: null,
        },
      });

      logAuthEvent('auth.register.local', { userId: user.id, email: user.email });

      return issueSession(res, user, 201);
    } catch (error) {
      console.error('[AUTH] Erro no registro:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.',
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/login - Autenticação de usuário existente
  // ==========================================================================
  /**
   * Autentica usuário e retorna access token + define refresh token em cookie
   * 
   * Fluxo:
   * 1. Valida payload (Zod middleware já aplicado)
   * 2. Busca usuário por e-mail
   * 3. Verifica se usuário existe (retorna 401 genérico se não)
   * 4. Valida senha com bcrypt
   * 5. Retorna 401 genérico se senha incorreta
   * 6. Gera access token (15min) e refresh token (7d)
   * 7. Define refresh token como cookie httpOnly
   * 8. Retorna access token no corpo
   * 9. Dispara job de recorrência (não bloqueia resposta)
   * 
   * Segurança:
   * - Mensagem genérica para usuário/senha incorreta (previne enumeração)
   * - Log de tentativas (IP disponível via req.ip se behind proxy)
   * - Refresh token em cookie httpOnly (inacessível por XSS)
   * - Sem rate limiting aqui (será feito em Milestone futura)
   */
  router.post('/login', validate({ body: loginSchema }), async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const safeEmail = normalizedEmail.replace(/[\r\n]/g, '');
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    try {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      if (!user || !user.passwordHash || (user.provider === Provider.GOOGLE && !user.passwordHash)) {
        console.warn(`[AUTH] Login failed - user not found or missing passwordHash: ${safeEmail} from ${clientIp}`);
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas.',
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        console.warn(`[AUTH] Login failed - invalid password: ${safeEmail} from ${clientIp}`);
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas.',
        });
      }

      publishRecurringJob(user.id).catch((error) => {
        console.error(`[AUTH] Failed to queue recurring job for user ${user.id}:`, error);
      });

      logAuthEvent('auth.login.local', { userId: user.id, email: user.email, provider: user.provider });

      return issueSession(res, user);
    } catch (error) {
      console.error('[AUTH] Erro no login:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.',
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/refresh - Renovar access token usando refresh token
  // ==========================================================================
  /**
   * Renova o access token usando o refresh token armazenado em cookie
   * 
   * Fluxo:
   * 1. Lê refresh token do cookie
   * 2. Valida assinatura JWT
   * 3. Extrai userId do payload
   * 4. Gera novo access token (15min)
   * 5. Retorna novo access token no corpo
   * 
   * Segurança:
   * - Refresh token nunca exposto ao cliente (apenas cookie httpOnly)
   * - Valida exp automaticamente pelo JWT
   * - Se token inválido/expirado → 401 (cliente deve redirecionar para /login)
   * 
   * Uso:
   * - Frontend chama quando access token expira (15min)
   * - Axios interceptor detecta 401 e tenta refresh automaticamente
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ 
          error: 'NO_REFRESH_TOKEN',
          message: 'Refresh token não encontrado. Faça login novamente.' 
        });
      }

      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, getJwtSecret());
      } catch (jwtError) {
        console.warn('[AUTH] Invalid refresh token:', jwtError);
        return res.status(401).json({ 
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Sessão expirada. Faça login novamente.' 
        });
      }

      const tokenType = (decoded as any).tokenType || (decoded as any).type;
      if (tokenType && tokenType !== 'refresh') {
        return res.status(401).json({
          error: 'INVALID_TOKEN_PAYLOAD',
          message: 'Token inválido. Faça login novamente.'
        });
      }

      const userId = typeof decoded.sub === 'string' ? decoded.sub : decoded.userId;

      if (!userId) {
        return res.status(401).json({ 
          error: 'INVALID_TOKEN_PAYLOAD',
          message: 'Token inválido. Faça login novamente.' 
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado.'
        });
      }

      return issueSession(res, user);
    } catch (error) {
      console.error('[AUTH] Erro ao renovar token:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.'
      });
    }
  });

  // ==========================================================================
  // GET /api/auth/me - Retorna usuário autenticado a partir do access token
  // ==========================================================================
  router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId || req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Não autorizado.'
      });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        console.warn(`[AUTH] User not found during /me lookup: ${userId}`);
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado.'
        });
      }

      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error('[AUTH] Erro ao consultar perfil do usuário:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.'
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/logout - Encerrar sessão (remover cookie)
  // ==========================================================================
  /**
   * Remove refresh token do cookie e encerra sessão
   * 
   * Fluxo:
   * 1. Remove cookie refreshToken
   * 2. Retorna 200 OK
   * 
   * Frontend:
   * - Limpar access token da memória
   * - Redirecionar para /login
   * 
   * Segurança:
   * - clearCookie deve usar as mesmas opções de criação (path, domain)
   * - Mesmo sem refresh token, endpoint retorna 200 (idempotente)
   */
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      // Remover cookie com as mesmas opções usadas na criação
      res.clearCookie('refreshToken', buildRefreshTokenClearOptions());

      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      console.log(`[AUTH] Logout from ${clientIp}`);

      return res.json({ 
        message: 'Sessão encerrada com sucesso.' 
      });
    } catch (error) {
      console.error('[AUTH] Erro no logout:', error);
      return res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.' 
      });
    }
  });

  // ==========================================================================
  // POST /api/auth/google - Login via Google OAuth2
  // ==========================================================================
  router.post('/google', googleAuthLimiter, validate({ body: googleLoginSchema }), async (req: Request, res: Response) => {
    if (!config.authGoogleEnabled) {
      return res.status(503).json({
        error: 'GOOGLE_AUTH_DISABLED',
        message: 'Login com Google está temporariamente indisponível.',
      });
    }

    try {
      const { credential } = googleLoginSchema.parse(req.body);
      let profile;
      try {
        profile = await verifyGoogleCredential(credential);
      } catch (err) {
        if (err instanceof GoogleTokenError) {
          return res.status(err.status).json({ error: err.code, message: err.message });
        }
        throw err;
      }

      const normalizedEmail = normalizeEmail(profile.email);

      let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

      if (!user) {
        const byEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (byEmail) {
          if (byEmail.provider === Provider.LOCAL) {
            logAuthEvent('auth.google.conflict', { email: normalizedEmail, localUserId: byEmail.id });
            return res.status(409).json({
              error: 'ACCOUNT_CONFLICT',
              code: 'ACCOUNT_CONFLICT',
              message: 'Já existe conta local para este e-mail. Use o fluxo de unificação.',
              data: { email: normalizedEmail, hasLocal: true, hasGoogle: false },
            });
          }
          const updateData = {
            googleId: profile.googleId,
            provider: Provider.GOOGLE,
            avatar: profile.avatar ?? byEmail.avatar ?? undefined,
            name: byEmail.name && byEmail.name.trim() !== '' ? byEmail.name : profile.name,
          };

          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: updateData,
          });
        }
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: profile.name,
            googleId: profile.googleId,
            provider: Provider.GOOGLE,
            avatar: profile.avatar,
          },
        });
      }

      publishRecurringJob(user.id).catch((error) => {
        console.error(`[AUTH] Failed to queue recurring job for user ${user.id}:`, error);
      });

      logAuthEvent('auth.login.google', { userId: user.id, email: user.email });

      return issueSession(res, user);
    } catch (error) {
      console.error('[AUTH] Erro no login Google:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
    }
  });

  // ==========================================================================
  // POST /api/auth/google/resolve-conflict - Merge Local + Google usando Google como canônico
  // ==========================================================================
  router.post('/google/resolve-conflict', googleAuthLimiter, validate({ body: googleResolveConflictSchema }), async (req: Request, res: Response) => {
    if (!config.authGoogleEnabled) {
      return res.status(503).json({
        error: 'GOOGLE_AUTH_DISABLED',
        message: 'Login com Google está temporariamente indisponível.',
      });
    }
    if (!config.authAccountLinkEnabled) {
      return res.status(503).json({
        error: 'ACCOUNT_LINK_DISABLED',
        message: 'Unificação de contas está temporariamente indisponível.',
      });
    }

    try {
      const { credential } = googleResolveConflictSchema.parse(req.body);
      let profile;
      try {
        profile = await verifyGoogleCredential(credential);
      } catch (err) {
        if (err instanceof GoogleTokenError) {
          return res.status(err.status).json({ error: err.code, message: err.message });
        }
        throw err;
      }

      const normalizedEmail = normalizeEmail(profile.email);

      const userLocal = await prisma.user.findFirst({
        where: { email: normalizedEmail, provider: Provider.LOCAL },
      });

      if (!userLocal) {
        return res.status(404).json({
          error: 'NO_LOCAL_ACCOUNT',
          message: 'Nenhuma conta LOCAL encontrada para este e-mail.',
        });
      }

      let googleUser = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId: profile.googleId },
            { email: normalizedEmail, provider: Provider.GOOGLE },
          ],
        },
      });

      if (!googleUser) {
        googleUser = await prisma.user.create({
          data: {
            email: normalizedEmail,
            googleId: profile.googleId,
            name: profile.name,
            avatar: profile.avatar,
            provider: Provider.GOOGLE,
          },
        });
      } else if (!googleUser.googleId) {
        googleUser = await prisma.user.update({
          where: { id: googleUser.id },
          data: {
            googleId: profile.googleId,
            provider: Provider.GOOGLE,
            avatar: googleUser.avatar ?? profile.avatar,
            name: googleUser.name ?? profile.name,
          },
        });
      }

      const { user: mergedUser, moved } = await mergeUsersUsingGoogleAsCanonical(prisma, {
        localUserId: userLocal.id,
        googleUserId: googleUser.id,
      });

      logAuthEvent('auth.account.merge', {
        userId: mergedUser.id,
        localUserId: userLocal.id,
        googleUserId: googleUser.id,
        email: mergedUser.email,
        moved,
      });

      return issueSession(res, mergedUser);
    } catch (error) {
      console.error('[AUTH] Erro ao resolver conflito Google:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
    }
  });

  // ==========================================================================
  // POST /api/auth/link/google - Vincular Google a uma conta autenticada
  // ==========================================================================
  router.post('/link/google', authenticate, validate({ body: linkGoogleSchema }), async (req: AuthenticatedRequest, res: Response) => {
    if (!config.authGoogleEnabled) {
      return res.status(503).json({
        error: 'GOOGLE_AUTH_DISABLED',
        message: 'Login com Google está temporariamente indisponível.',
      });
    }
    if (!config.authAccountLinkEnabled) {
      return res.status(503).json({
        error: 'ACCOUNT_LINK_DISABLED',
        message: 'Vínculo de contas está temporariamente indisponível.',
      });
    }

    const authUserId = req.auth?.userId || req.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autorizado.' });
    }

    try {
      const { credential } = linkGoogleSchema.parse(req.body);
      let profile;
      try {
        profile = await verifyGoogleCredential(credential);
      } catch (err) {
        if (err instanceof GoogleTokenError) {
          return res.status(err.status).json({ error: err.code, message: err.message });
        }
        throw err;
      }

      const normalizedEmail = normalizeEmail(profile.email);
      const currentUser = await prisma.user.findUnique({ where: { id: authUserId } });

      if (!currentUser) {
        return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' });
      }

      if (normalizeEmail(currentUser.email) !== normalizedEmail) {
        return res.status(409).json({
          error: 'EMAIL_MISMATCH',
          message: 'O e-mail do Google não corresponde ao e-mail da conta atual.',
        });
      }

      if (currentUser.googleId && currentUser.googleId !== profile.googleId) {
        return res.status(409).json({
          error: 'GOOGLE_ID_MISMATCH',
          message: 'Esta conta já está vinculada a outro Google ID.',
        });
      }

      let resultUser: PrismaUser | null = null;

      const existingGoogle = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId: profile.googleId },
            { email: normalizedEmail, provider: Provider.GOOGLE },
          ],
        },
      });

      if (existingGoogle && existingGoogle.id !== currentUser.id) {
        const { user: mergedUser, moved } = await mergeUsersUsingGoogleAsCanonical(prisma, {
          localUserId: currentUser.id,
          googleUserId: existingGoogle.id,
        });
        logAuthEvent('auth.account.linked', {
          userId: mergedUser.id,
          localUserId: currentUser.id,
          googleUserId: existingGoogle.id,
          email: mergedUser.email,
          origin: 'link-google-endpoint',
          moved,
        });
        resultUser = mergedUser;
      } else {
        resultUser = await prisma.user.update({
          where: { id: currentUser.id },
          data: {
            googleId: profile.googleId,
            provider: Provider.GOOGLE,
            avatar: currentUser.avatar ?? profile.avatar,
            name: currentUser.name ?? profile.name,
          },
        });
        logAuthEvent('auth.account.linked', {
          userId: resultUser.id,
          localUserId: currentUser.id,
          googleUserId: resultUser.id,
          email: resultUser.email,
          origin: 'link-google-endpoint',
        });
      }

      return issueSession(res, resultUser);
    } catch (error) {
      console.error('[AUTH] Erro ao vincular conta Google:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
    }
  });

  return router;
}
