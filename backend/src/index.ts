import express, { Request } from 'express';
import cors from 'cors';
import helmet, { type HelmetOptions } from 'helmet';
import cookieParser from 'cookie-parser';
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
import { apiLimiter } from './middlewares/rateLimiter';

import csurf from 'csurf';

const app = express();
const port = config.port;
const prisma = new PrismaClient();

// Middlewares
const helmetOptions: HelmetOptions = {};

if (process.env.NODE_ENV !== 'production') {
  const defaultDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
  helmetOptions.contentSecurityPolicy = {
    useDefaults: true,
    directives: {
      ...defaultDirectives,
      "script-src": ["'self'", "'unsafe-eval'"],
    },
  };
}

app.use(helmet(helmetOptions));

/**
 * CORS Configuration - Milestone #13
 * 
 * Segurança:
 * - credentials: true → permite envio de cookies entre domínios
 * - origin callback → allowlist de origens permitidas (dev + prod)
 * - Rejeita requisições de origens desconhecidas
 * 
 * Origens permitidas:
 * - Dev: http://localhost:5173 (Vite)
 * - Prod: definido via ALLOWED_ORIGINS env var
 * 
 * IMPORTANTE: Nunca usar origin: '*' com credentials: true (erro CORS)
 */
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sem origin (ex: mobile apps, Postman)
      if (!origin) return callback(null, true);
      
      if (isCorsAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Permite envio de cookies
  })
);

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

// Middleware CSRF - protege rotas autenticadas
// Usa cookie para armazenar o token CSRF
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
});

app.use('/api', apiLimiter);

// Expor o token CSRF em uma rota pública para o frontend buscar
// IMPORTANTE: Esta rota deve vir ANTES de aplicar o middleware CSRF
app.get('/api/csrf-token', csrfProtection, (req: Request, res) => {
  res.json({ csrfToken: req.csrfToken ? req.csrfToken() : null });
});

// Aplicar CSRF protection em todas as outras rotas
app.use(csrfProtection);

// Rotas públicas (sem autenticação)
app.use('/api/auth', authRoutes(prisma));
app.use('/api/health', healthRoutes); // Health check para Docker e monitoramento

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

// TODO:
// 1. Adicionar rotas protegidas (/api/expenses, /api/origins, etc.)

// Middleware global de erros
app.use(globalErrorHandler);


// Só inicia o servidor se não estiver em ambiente de teste
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🚀 Backend server pronto e rodando na porta ${port}`);
    console.log(`🔗 Teste em: http://localhost:${port}/api/status`);
  });
}

export default app;
