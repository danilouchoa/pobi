import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmet, { type HelmetOptions } from 'helmet';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import { authenticate } from './middlewares/auth';
import expensesRoutes from './routes/expenses';
import originsRoutes from './routes/origins';
import debtorsRoutes from './routes/debtors';
import salaryHistoryRoutes from './routes/salaryHistory';
import jobsRoutes from './routes/jobs';
import healthRoutes from './routes/health';
import dlqRoutes from './routes/dlq';
import { requestLogger } from './middlewares/logger';
import { globalErrorHandler, invalidJsonHandler } from './middlewares/errorHandler';
import { config, isCorsAllowed } from './config';
import { authLimiter, authSensitiveLimiter } from './middlewares/rateLimiter';

const app = express();
const port = config.port;
const prisma = new PrismaClient();
const googleTrustedHosts = ["https://accounts.google.com", "https://*.gstatic.com"];

const scriptSrcDirectives = ["'self'", ...googleTrustedHosts];

if (config.nodeEnv !== 'production') {
  // Vite e bibliotecas de desenvolvimento podem depender de eval em ambientes locais.
  // Mantemos 'unsafe-eval' apenas fora da produção para preservar segurança.
  scriptSrcDirectives.push("'unsafe-eval'");
}

const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': scriptSrcDirectives,
      'frame-src': ["'self'", 'https://accounts.google.com'],
      'img-src': ["'self'", 'data:', 'https://*.gstatic.com'],
    },
  },
};

const allowAllOrigins = config.corsOrigins.length === 0 || config.corsOrigins.includes('*');
const corsMiddleware = cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowAllOrigins) {
      return callback(null, true);
    }
    if (config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Origin blocked: ${origin}`);
    return callback(new Error('Origin not allowed by CORS'), false);
  },
});

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  },
});

// Middlewares
// Helmet removido para rodar localmente sem headers extras

/**
 * Helmet + CSP garantem headers básicos e limitam origens externas
 * Google OAuth requer liberarmos accounts.google.com e *.gstatic.com
 */
app.use(helmet(helmetOptions));

/**
 * CORS Configuration - Milestone #13
 * Mantém allowlist baseada nas envs FRONTEND_ORIGIN + CORS_ORIGINS
 */
app.use(corsMiddleware);

/**
 * Cookie Parser - Milestone #13
 *
 * Permite ler cookies do request (req.cookies)
 * Necessário para refresh token armazenado em cookie httpOnly
 */
app.use(cookieParser());

app.use(requestLogger);
app.use(express.json()); // Habilita o parsing de JSON
app.use(invalidJsonHandler);

app.use(csrfProtection);
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = req.csrfToken();
  res.json({ csrfToken });
});

// apiLimiter removido para rodar localmente

// Rota CSRF removida

// CSRF protection removido

// Rotas públicas (sem autenticação)
// ============================================================================
app.use('/api/auth', authRoutes(prisma));
app.use('/api/health', healthRoutes); // Health check para Docker e monitoramento

// ============================================================================
// Rotas autenticadas
app.use('/api/expenses', authenticate, expensesRoutes(prisma));
app.use('/api/origins', authenticate, originsRoutes(prisma));
app.use('/api/debtors', authenticate, debtorsRoutes(prisma));
app.use('/api/salaryHistory', authenticate, salaryHistoryRoutes(prisma));
app.use('/api/jobs', authenticate, jobsRoutes(prisma));
app.use('/api/dlq', authenticate, dlqRoutes); // Dead Letter Queue admin

// Rota de Teste "Hello World"
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Backend do Finance App está rodando!',
    timestamp: new Date().toISOString(),
  });
});

// Middleware global de erros
app.use(globalErrorHandler);

// Só inicia o servidor se não estiver em ambiente de teste
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🚀 Backend server pronto e rodando na porta ${port}`);
    console.log(`🔗 Teste em: http://localhost:${port}/api/status`);
    console.log(`🔒 Security mode: ${config.securityMode}`);
  });
}

export default app;
