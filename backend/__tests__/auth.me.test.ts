import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

import app from '../src/index';
import { loginTestUser, getPrismaMock } from './helpers/expenseTestUtils';

const prisma = getPrismaMock();

describe('GET /api/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
  });

  it('deve retornar os dados do usuário autenticado', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'danilo.uchoa@finance.app',
      name: 'Danilo Uchoa',
      provider: 'LOCAL',
      avatar: null,
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('danilo.uchoa@finance.app');
  });

  it('deve retornar 404 quando usuário não for encontrado', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('USER_NOT_FOUND');
  });
});
