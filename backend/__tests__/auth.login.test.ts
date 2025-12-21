import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';
import { resetUserFactory, createLocalUser } from './factories/userFactory';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUserFactory();
  });

  it('deve autenticar com credenciais válidas e retornar cookie httpOnly', async () => {
    await createLocalUser({
      id: 'user-123',
      email: 'danilo.uchoa@finance.app',
      name: 'Danilo Uchoa',
      password: 'finance123',
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'danilo.uchoa@finance.app', password: 'finance123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('danilo.uchoa@finance.app');
  });

  it('aceita o alias /api/bff/auth/login sem alterar o contrato', async () => {
    await createLocalUser({
      id: 'user-124',
      email: 'alias.login@finance.app',
      name: 'Alias Login',
      password: 'finance123',
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/bff/auth/login')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'alias.login@finance.app', password: 'finance123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('alias.login@finance.app');
  });

  it('deve rejeitar login com credenciais inválidas', async () => {
    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'danilo.uchoa@finance.app', password: 'senhaErrada' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('deve rejeitar login se usuario nao tem passwordHash', async () => {
    await createLocalUser({
      id: 'user-456',
      email: 'sem.senha@finance.app',
      name: 'Sem Senha',
      passwordHash: null as any,
      password: undefined,
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'sem.senha@finance.app', password: 'qualquer' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });
});
