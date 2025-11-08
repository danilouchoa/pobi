import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import { authenticate } from './middlewares/auth';
import expensesRoutes from './routes/expenses';
import originsRoutes from './routes/origins';
import debtorsRoutes from './routes/debtors';
import salaryHistoryRoutes from './routes/salaryHistory';
import jobsRoutes from './routes/jobs';
import { requestLogger } from './middlewares/logger';
import { globalErrorHandler, invalidJsonHandler } from './middlewares/errorHandler';
import { config, isCorsAllowed } from './config';

const app = express();
const port = config.port;
const prisma = new PrismaClient();

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isCorsAllowed(origin || undefined)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(requestLogger);
app.use(express.json()); // Habilita o parsing de JSON
app.use(invalidJsonHandler);

// Rotas
app.use('/api/auth', authRoutes(prisma));
app.use('/api/expenses', authenticate, expensesRoutes(prisma));
app.use('/api/origins', authenticate, originsRoutes(prisma));
app.use('/api/debtors', authenticate, debtorsRoutes(prisma));
app.use('/api/salaryHistory', authenticate, salaryHistoryRoutes(prisma));
app.use('/api/jobs', authenticate, jobsRoutes(prisma));

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

// Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 Backend server pronto e rodando na porta ${port}`);
  console.log(`🔗 Teste em: http://localhost:${port}/api/status`);
});
