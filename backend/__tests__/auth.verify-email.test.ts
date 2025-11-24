import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';
import { createLocalUser, getUsers, getVerificationTokens, resetUserFactory, userFactoryPrisma } from './factories/userFactory';
import { generateVerificationToken } from '../src/services/emailVerification';

const createTokenForUser = async (userId: string, overrides: Partial<{ expiresAt: Date; consumedAt: Date | null }> = {}) => {
  const { rawToken, tokenHash } = generateVerificationToken();
  const record = await userFactoryPrisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      consumedAt: overrides.consumedAt ?? null,
    },
  });
  return { rawToken, record };
};

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUserFactory();
  });

  it('marca e-mail como verificado com token válido', async () => {
    const user = await createLocalUser({ email: 'verify@finance.app' });
    const { rawToken } = await createTokenForUser(user.id);
    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/verify-email')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ token: rawToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    const tokens = getVerificationTokens();
    expect(tokens[0].consumedAt).not.toBeNull();
  });

  it('retorna erro para token expirado', async () => {
    const user = await createLocalUser({ email: 'expired@finance.app' });
    const { rawToken } = await createTokenForUser(user.id, { expiresAt: new Date(Date.now() - 1000) });
    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/verify-email')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ token: rawToken });

    expect(res.status).toBe(410);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
  });

  it('retorna erro para token já utilizado', async () => {
    const user = await createLocalUser({ email: 'used@finance.app' });
    const { rawToken } = await createTokenForUser(user.id, { consumedAt: new Date() });
    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/verify-email')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ token: rawToken });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TOKEN_ALREADY_USED');
  });
});

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUserFactory();
  });

  it('cria novo token para usuário não verificado', async () => {
    await createLocalUser({ email: 'resend@finance.app', password: 'Password123' });
    const { csrfToken, csrfCookie } = await getCsrfToken();
    const login = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'resend@finance.app', password: 'Password123' });

    expect(login.body.accessToken).toBeDefined();
    const accessToken = login.body.accessToken as string;

    const cookies: string[] = [];
    if (Array.isArray(login.headers['set-cookie'])) {
      cookies.push(...login.headers['set-cookie']);
    } else if (login.headers['set-cookie']) {
      cookies.push(login.headers['set-cookie'] as string);
    }
    cookies.push(csrfCookie);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESENT');
    expect(getVerificationTokens().length).toBeGreaterThanOrEqual(1);
  });
});
