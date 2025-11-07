import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { publishRecurringJob } from '../lib/rabbit';

const SALT_ROUNDS = 10;

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET não definido. Configure no arquivo .env');
  }

  return secret;
};

const generateToken = (userId: string) =>
  jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' });

const sanitizeUser = (user: { id: string; email: string; name: string | null }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
});

export default function authRoutes(prisma: PrismaClient) {
  const router = Router();

  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });

      if (existingUser) {
        return res.status(409).json({ message: 'Usuário já cadastrado.' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const user = await prisma.user.create({
        data: { email, passwordHash, name },
      });

      const token = generateToken(user.id);

      res.status(201).json({
        user: sanitizeUser(user),
        token,
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      res.status(500).json({ message: 'Erro interno no servidor.' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      const token = generateToken(user.id);

      try {
        await publishRecurringJob(user.id);
      } catch (rabbitError) {
        console.error('[Auth] Failed to queue recurring job on login:', rabbitError);
      }

      res.json({
        user: sanitizeUser(user),
        token,
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro interno no servidor.' });
    }
  });

  return router;
}
