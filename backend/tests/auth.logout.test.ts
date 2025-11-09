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

describe('POST /api/auth/logout', () => {
  it('deve remover o cookie refreshToken e encerrar sessão', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshTokenCookie)
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    // O cookie refreshToken deve ser removido
    let setCookieArr: string[] = [];
    const setCookieRaw = res.headers['set-cookie'];
    if (Array.isArray(setCookieRaw)) {
      setCookieArr = setCookieRaw;
    } else if (typeof setCookieRaw === 'string') {
      setCookieArr = [setCookieRaw];
    }
    const cleared = setCookieArr.some((c) => c.startsWith('refreshToken=') && c.includes('Expires=Thu, 01 Jan 1970'));
    expect(cleared).toBe(true);
  });

  it('deve ser idempotente mesmo sem refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});
