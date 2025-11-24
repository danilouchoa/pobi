import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';
import { resetUserFactory, createLocalUser, createGoogleUser, getConsents } from './factories/userFactory';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUserFactory();
  });

  it('cria usuário LOCAL e retorna tokens', async () => {
    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'new.user@finance.app', password: 'Password123', name: 'New User', acceptedTerms: true, termsVersion: '2025-11-26' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new.user@finance.app');
    expect(res.body.user.provider).toBe('LOCAL');
    expect(res.body.user.googleLinked).toBe(false);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(getConsents()).toHaveLength(1);
    expect(getConsents()[0]).toMatchObject({
      purpose: 'BASIC_TERMS_AND_PRIVACY',
      version: '2025-11-26',
    });
  });

  it('retorna 409 se já existir usuário LOCAL com o mesmo email', async () => {
    await createLocalUser({ email: 'duplicado@finance.app' });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'duplicado@finance.app', password: 'Password123', acceptedTerms: true, termsVersion: '2025-11-26' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DUPLICATE_USER');
  });

  it('retorna erro específico quando já existe conta GOOGLE para o email', async () => {
    await createGoogleUser({ email: 'has.google@finance.app' });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'has.google@finance.app', password: 'Password123', acceptedTerms: true, termsVersion: '2025-11-26' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('GOOGLE_ACCOUNT_EXISTS');
  });

  it('rejeita cadastro quando termos não são aceitos', async () => {
    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'terms@finance.app', password: 'Password123', acceptedTerms: false, termsVersion: '2025-11-26' });

    expect(res.status).toBe(400);
  });
});
