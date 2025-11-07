import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do .env
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(cors()); // Habilita o CORS
app.use(express.json()); // Habilita o parsing de JSON

// Rota de Teste "Hello World"
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Backend do Finance App está rodando!',
    timestamp: new Date().toISOString(),
  });
});

// TODO:
// 1. Conectar ao Prisma Client
// 2. Adicionar rotas de autenticação (/api/auth)
// 3. Adicionar rotas protegidas (/api/expenses, /api/origins, etc.)

// Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 Backend server pronto e rodando na porta ${port}`);
  console.log(`🔗 Teste em: http://localhost:${port}/api/status`);
});