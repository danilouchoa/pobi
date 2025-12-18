
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';

const prisma = new PrismaClient() as any;

const invalidPayloads = [
  { route: '/api/expenses', payload: { valor: 'not-a-number' } },
  { route: '/api/salaryHistory', payload: { amount: null } },
  { route: '/api/origins', payload: { name: '' } },
  { route: '/api/debtors', payload: { name: 123 } },
];

let accessToken: string;

beforeAll(async () => {
  // Mockar usuário existente no banco
  const mockUser = {
    id: 'user-123',
    email: 'danilo.uchoa@finance.app',
    name: 'Danilo Uchoa',
    emailVerifiedAt: new Date(),
    passwordHash: await bcrypt.hash('finance123', 10),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  prisma.user.findUnique.mockResolvedValue(mockUser);

  const csrf = await getCsrfToken();
  const res = await request(app)
    .post('/api/auth/login')
    .set('Cookie', csrf.csrfCookie)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ email: 'danilo.uchoa@finance.app', password: 'finance123' });
  accessToken = res.body.accessToken;
});

describe('Validação Zod - API', () => {
  invalidPayloads.forEach(({ route, payload }) => {
    it(`deve retornar 400 para payload inválido em ${route}`, async () => {
      const csrf = await getCsrfToken();
      const res = await request(app)
        .post(route)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', csrf.csrfCookie)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send(payload);
      expect([400, 422]).toContain(res.status);
      expect(res.body).toMatchObject({ message: expect.any(String) });
    });
  });
});
