import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Importar o app DEPOIS dos mocks do setup.ts
import app from '../src/index';

// Obter instância mockada do Prisma
const prisma = new PrismaClient() as any;

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve autenticar com credenciais válidas e retornar cookie httpOnly', async () => {
    // Mockar usuário existente no banco
    const mockUser = {
      id: 'user-123',
      email: 'danilo.uchoa@finance.app',
      name: 'Danilo Uchoa',
      passwordHash: await bcrypt.hash('finance123', 10),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'danilo.uchoa@finance.app', password: 'finance123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('danilo.uchoa@finance.app');
  });

  it('deve rejeitar login com credenciais inválidas', async () => {
    // Mockar usuário não encontrado
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'danilo.uchoa@finance.app', password: 'senhaErrada' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });
});
