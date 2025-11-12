import { Router, Request, Response, type CookieOptions } from 'express';
import { PrismaClient, Provider } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { publishRecurringJob } from '../lib/rabbit';
import { validate } from '../middlewares/validation';
import { registerSchema, loginSchema, googleLoginSchema } from '../schemas/auth.schema';
// import { authLimiter, authSensitiveLimiter } from '../middlewares/rateLimiter';
import rateLimit from 'express-rate-limit';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Limitar POST /auth/google para 5 requisições por minuto por IP
const googleAuthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // 5 requisições por janela por IP
  handler: (req, res) => {
    res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente mais tarde.' });
  }
});

/**
 * Recupera o segredo JWT do ambiente
 * @throws Error se JWT_SECRET não estiver definido
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET não definido. Configure no arquivo .env');
  }

  return secret;
};

/**
 * Gera um access token de curta duração (15 minutos)
 * Access token é enviado no corpo da resposta e armazenado em memória no frontend
 * 
 * @param userId - ID do usuário
 * @returns JWT assinado com expiração de 15min
 */
const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '15m' });
};

/**
 * Gera um refresh token de longa duração (7 dias)
 * Refresh token é enviado como cookie httpOnly e usado para renovar o access token
 * 
 * @param userId - ID do usuário
 * @returns JWT assinado com expiração de 7 dias
 */
const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' });
};

/**
 * Remove campos sensíveis do objeto user antes de enviar ao cliente
 * 
 * @param user - Objeto user do Prisma
 * @returns User sem passwordHash e outros campos internos
 */
type PrismaUser = {
  id: string;
  email: string;
  name: string | null;
  avatar?: string | null;
  provider?: Provider | null;
};

const sanitizeUser = (user: PrismaUser) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar ?? null,
  provider: user.provider ?? Provider.LOCAL,
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

export default function authRoutes(prisma: PrismaClient) {
  const router = Router();

  // Google OAuth2 client (used to validate ID tokens sent by frontend)
  const googleClient = new OAuth2Client(config.googleClientId);

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

      // Verificar se usuário já existe
      const existingUser = await prisma.user.findUnique({ where: { email } });

      if (existingUser) {
        return res.status(409).json({ 
          error: 'DUPLICATE_USER',
          message: 'Usuário já cadastrado.' 
        });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Criar usuário
      const user = await prisma.user.create({
        data: { email, passwordHash, name, provider: Provider.LOCAL },
      });

      // Gerar tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Definir refresh token como cookie httpOnly
      // IMPORTANTE: Cookie não acessível via JavaScript (previne XSS)
      res.cookie('refreshToken', refreshToken, buildRefreshTokenCookieOptions());

      // Log de sucesso (sem dados sensíveis)
      console.log(`[AUTH] Novo usuário registrado: ${email}`);

      // Retornar access token no corpo (será armazenado em memória)
      return res.status(201).json({
        user: sanitizeUser(user),
        accessToken,
      });
    } catch (error) {
      console.error('[AUTH] Erro no registro:', error);
      return res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.' 
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
    const safeEmail = typeof email === 'string' ? email.replace(/[\r\n]/g, '') : '';
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    try {
      // Buscar usuário por e-mail
      const user = await prisma.user.findUnique({ where: { email } });

      // Se usuário não existe → mensagem genérica
      if (!user) {
        console.warn(`[AUTH] Login failed - user not found: ${safeEmail} from ${clientIp}`);
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas.' 
        });
      }

      // Validar senha com bcrypt (ignora usuários sem passwordHash)
      if (!user.passwordHash) {
        console.warn(`[AUTH] Login failed - user has no passwordHash: ${safeEmail} from ${clientIp}`);
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas.' 
        });
      }
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      // Se senha incorreta → mesma mensagem genérica
      if (!isValidPassword) {
        console.warn(`[AUTH] Login failed - invalid password: ${safeEmail} from ${clientIp}`);
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Credenciais inválidas.' 
        });
      }

      // TODO: Verificar se usuário está ativo (se houver campo active: boolean)
      // if (!user.active) {
      //   console.warn(`[AUTH] Login failed - inactive user: ${email}`);
      //   return res.status(403).json({ message: 'Conta desativada.' });
      // }

      // Gerar tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Definir refresh token como cookie httpOnly
      res.cookie('refreshToken', refreshToken, buildRefreshTokenCookieOptions());

      // Disparar job de recorrência (não bloquear response)
      // Erro aqui não deve impedir o login
      publishRecurringJob(user.id).catch((error) => {
        console.error(`[AUTH] Failed to queue recurring job for user ${user.id}:`, error);
      });

      // Log de sucesso
      console.log(`[AUTH] Login success: ${safeEmail} from ${clientIp}`);

      // Retornar access token no corpo
      return res.json({
        user: sanitizeUser(user),
        accessToken,
      });
    } catch (error) {
      console.error('[AUTH] Erro no login:', error);
      return res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Erro interno no servidor.' 
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
      // Ler refresh token do cookie
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ 
          error: 'NO_REFRESH_TOKEN',
          message: 'Refresh token não encontrado. Faça login novamente.' 
        });
      }

      // Validar refresh token
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

      // Extrair userId do token
      const { userId } = decoded;

      if (!userId) {
        return res.status(401).json({ 
          error: 'INVALID_TOKEN_PAYLOAD',
          message: 'Token inválido. Faça login novamente.' 
        });
      }

      // Gerar novo access token
      const newAccessToken = generateAccessToken(userId);

      // Opcional: Rotação de refresh token (gerar novo refresh token)
      // const newRefreshToken = generateRefreshToken(userId);
      // res.cookie('refreshToken', newRefreshToken, { ... });

      return res.json({
        accessToken: newAccessToken,
      });
    } catch (error) {
      console.error('[AUTH] Erro ao renovar token:', error);
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
    try {
      const { credential } = googleLoginSchema.parse(req.body);

      let ticket;
      try {
        ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
      } catch (verifyError) {
        console.warn('[AUTH] Google token verification failed:', verifyError);
        return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN', message: 'Token inválido.' });
      }

      const payload = ticket.getPayload();

      if (!payload) {
        return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN', message: 'Token inválido.' });
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
        return res.status(400).json({ error: 'INVALID_GOOGLE_PAYLOAD', message: 'Payload incompleto.' });
      }

      if (!emailVerified) {
        return res.status(400).json({ error: 'EMAIL_NOT_VERIFIED', message: 'Email não verificado pelo provedor.' });
      }

      // Buscar usuário por googleId primeiro
      let user = await prisma.user.findUnique({ where: { googleId } });

      // Se não encontrou por googleId, tentar por email e vincular
      if (!user) {
        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          // Vincular conta existente
          const updateData: { googleId: string; provider: Provider; avatar?: string | undefined; name?: string } = {
            googleId,
            provider: Provider.GOOGLE,
            avatar,
          };

          if ((!byEmail.name || byEmail.name.trim() === '') && name) {
            updateData.name = name;
          }

          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: updateData,
          });
        }
      }

      // Se ainda não existe, criar usuário novo
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            googleId,
            provider: Provider.GOOGLE,
            avatar,
            // passwordHash deixado vazio para contas OAuth (campo opcional no schema)
          },
        });
      }

      // Gerar tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Definir cookie com opções de segurança
      res.cookie('refreshToken', refreshToken, buildRefreshTokenCookieOptions());

      // Log sem expor tokens
      console.log(`[AUTH] Google login success for ${email}`);

      return res.json({ user: sanitizeUser(user), accessToken });
    } catch (error) {
      console.error('[AUTH] Erro no login Google:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
    }
  });

  return router;
}
