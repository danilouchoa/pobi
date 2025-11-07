import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import { authenticate } from './middlewares/auth';
import expensesRoutes from './routes/expenses';
import originsRoutes from './routes/origins';
import debtorsRoutes from './routes/debtors';
import salaryHistoryRoutes from './routes/salaryHistory';
import { requestLogger } from './middlewares/logger';
import { globalErrorHandler, invalidJsonHandler } from './middlewares/errorHandler';

// Carrega as variáveis de ambiente do .env
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

// Middlewares
app.use(cors()); // Habilita o CORS
app.use(requestLogger);
app.use(express.json()); // Habilita o parsing de JSON
app.use(invalidJsonHandler);

// Rotas
app.use('/api/auth', authRoutes(prisma));
app.use('/api/expenses', authenticate, expensesRoutes(prisma));
app.use('/api/origins', authenticate, originsRoutes(prisma));
app.use('/api/debtors', authenticate, debtorsRoutes(prisma));
app.use('/api/salaryHistory', authenticate, salaryHistoryRoutes(prisma));

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
