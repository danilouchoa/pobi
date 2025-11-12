import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
// IMPORTANT: mock google-auth-library BEFORE importing app to ensure route uses stub
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class {
      constructor() {}
      async verifyIdToken() {
        return (this as any).__verifyResult || { getPayload: () => null };
      }
    },
  };
});
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';

// Mock Prisma client used by routes (tests rely on mocking methods). @prisma/client is already mocked in setup.ts
const prisma = new PrismaClient() as any;

describe('POST /api/auth/google', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { OAuth2Client } = await import('google-auth-library');
    (OAuth2Client.prototype as any).__verifyResult = undefined;
    (OAuth2Client.prototype as any).verifyIdToken = async function () {
      return (this as any).__verifyResult || { getPayload: () => null };
    };
  });

  it('should create a new user when none exists and return accessToken + cookie', async () => {
    // Mock Google verification payload
    const payload = {
      email: 'new.user@finance.app',
      email_verified: true,
      sub: 'google-123',
      name: 'New User',
      picture: 'https://avatar.test/img.png',
    };

    // Inject custom verify result
    const { OAuth2Client } = await import('google-auth-library');
    (OAuth2Client.prototype as any).__verifyResult = { getPayload: () => payload };

    // Prisma: no user by googleId or email
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user-new',
      email: payload.email,
      name: payload.name,
      createdAt: new Date(),
      provider: 'GOOGLE',
      googleId: payload.sub,
      avatar: payload.picture,
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'dummy-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(payload.email);
    expect(res.body.user.provider).toBe('GOOGLE');
    expect(res.body.user.avatar).toBe(payload.picture);
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = res.headers['set-cookie'][0] as string;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Domain=localhost');
  });

  it('should link existing local account by email', async () => {
    const payload = {
      email: 'exists@finance.app',
      email_verified: true,
      sub: 'google-456',
      name: 'Exists',
      picture: null,
    };

    const { OAuth2Client } = await import('google-auth-library');
    (OAuth2Client.prototype as any).__verifyResult = { getPayload: () => payload };

    // First call (find by googleId) -> null
    // Second call (find by email) -> existing user
    prisma.user.findUnique = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementationOnce(() => Promise.resolve({ id: 'local-1', email: payload.email, name: 'Local', passwordHash: 'hash' }));

    prisma.user.update = vi.fn().mockResolvedValue({ id: 'local-1', email: payload.email, name: 'Local' });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'dummy-token' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(res.body.user.email).toBe(payload.email);
  });

  it('should return 401 for invalid token', async () => {
    // Make verify throw
    const { OAuth2Client } = await import('google-auth-library');
    (OAuth2Client.prototype as any).verifyIdToken = vi.fn(async () => {
      throw new Error('invalid');
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('should return 400 when email not verified', async () => {
    const payload = {
      email: 'unverified@finance.app',
      email_verified: false,
      sub: 'google-789',
    };

    const { OAuth2Client } = await import('google-auth-library');
    (OAuth2Client.prototype as any).__verifyResult = { getPayload: () => payload };

    const { csrfToken, csrfCookie } = await getCsrfToken();
    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'dummy-token' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
  });
});
