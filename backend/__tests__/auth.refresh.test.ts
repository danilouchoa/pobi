import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';

const prisma = new PrismaClient() as any;
let refreshTokenCookie: string;
let csrfToken: string;
let csrfCookie: string;

beforeAll(async () => {
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

  // Realiza login para obter refreshToken válido
  const csrf = await getCsrfToken();
  csrfToken = csrf.csrfToken;
  csrfCookie = csrf.csrfCookie;
  const res = await request(app)
    .post('/api/auth/login')
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'danilo.uchoa@finance.app', password: 'finance123' });
  const cookies = res.headers['set-cookie'];
  if (Array.isArray(cookies)) {
    refreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken='));
  } else if (typeof cookies === 'string') {
    refreshTokenCookie = cookies;
  } else {
    refreshTokenCookie = '';
  }
});

describe('POST /api/auth/refresh', () => {
  it('deve renovar access token com refreshToken válido', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [refreshTokenCookie, csrfCookie].filter(Boolean).join('; '))
      .set('X-CSRF-Token', csrfToken)
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    // O endpoint não retorna user, apenas accessToken
  });

  it('deve rejeitar refresh token inválido', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=tokeninvalido', csrf.csrfCookie].join('; '))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send();
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
