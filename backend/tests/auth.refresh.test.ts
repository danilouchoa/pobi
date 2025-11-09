import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index';

let refreshTokenCookie: string;

beforeAll(async () => {
  // Realiza login para obter refreshToken válido
  const res = await request(app)
    .post('/api/auth/login')
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
      .set('Cookie', refreshTokenCookie)
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    // O endpoint não retorna user, apenas accessToken
  });

  it('deve rejeitar refresh token inválido', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=tokeninvalido')
      .send();
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
