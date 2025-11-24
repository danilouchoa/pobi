import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import app from '../src/index';
import { getCsrfToken } from './utils/csrf';

const prisma = new PrismaClient() as any;

const mockVerifyIdToken = vi.hoisted(() => vi.fn());

vi.mock('google-auth-library', () => {
  class OAuth2ClientMock {
    verifyIdToken = mockVerifyIdToken;
  }

  return {
    OAuth2Client: OAuth2ClientMock,
  };
});

describe('POST /api/auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyIdToken.mockReset();
  });

  const createPayload = (overrides: Record<string, unknown> = {}) => ({
    email: 'new.user@finance.app',
    email_verified: true,
    sub: 'google-user-123',
    name: 'New User',
    picture: 'https://lh3.googleusercontent.com/a/AEdFTp12345',
    ...overrides,
  });

  it('cria novo usuário quando não existe registro com googleId ou email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // by googleId
    prisma.user.findUnique.mockResolvedValueOnce(null); // by email

    const createdUser = {
      id: 'user-created-1',
      email: 'new.user@finance.app',
      name: 'New User',
      googleId: 'google-user-123',
      provider: 'GOOGLE',
      avatar: 'https://lh3.googleusercontent.com/a/AEdFTp12345',
    };

    prisma.user.create.mockResolvedValueOnce(createdUser);

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => createPayload(),
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'valid-google-token' });

    expect(res.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: createdUser.email,
        googleId: createdUser.googleId,
        provider: 'GOOGLE',
        avatar: createdUser.avatar,
        name: createdUser.name,
      }),
    });
    expect(res.body).toEqual({
      user: {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        avatar: createdUser.avatar,
        provider: 'GOOGLE',
        googleLinked: true,
      },
      accessToken: expect.any(String),
    });

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const refreshCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(refreshCookie).toContain('refreshToken=');
    expect(refreshCookie.toLowerCase()).toContain('httponly');
    expect(refreshCookie).toContain('SameSite=Strict');
  });

  it('atualiza usuário GOOGLE existente pelo email quando googleId está vazio', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // by googleId

    const existingUser = {
      id: 'existing-user-1',
      email: 'existing.user@finance.app',
      name: '',
      provider: 'GOOGLE',
      googleId: null,
      avatar: null,
    };

    prisma.user.findUnique.mockResolvedValueOnce(existingUser); // by email

    const updatedUser = {
      ...existingUser,
      provider: 'GOOGLE',
      googleId: 'google-existing-1',
      avatar: 'https://lh3.googleusercontent.com/a/AEdFTp67890',
      name: 'Existing User',
    };

    prisma.user.update.mockResolvedValueOnce(updatedUser);

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => createPayload({
        email: existingUser.email,
        sub: updatedUser.googleId,
        name: updatedUser.name,
        picture: updatedUser.avatar,
      }),
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'valid-google-token-existing' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: existingUser.id },
      data: expect.objectContaining({
        googleId: updatedUser.googleId,
        provider: 'GOOGLE',
        avatar: updatedUser.avatar,
        name: updatedUser.name,
      }),
    });
    expect(res.body.user).toEqual({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      provider: 'GOOGLE',
      googleLinked: true,
    });
  });

  it('atualiza usuário LOCAL existente ao logar com Google com mesmo email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // by googleId

    const localUser = {
      id: 'local-user-1',
      email: 'conflict.user@finance.app',
      name: 'Local User',
      provider: 'LOCAL',
      googleId: null,
      avatar: null,
    };

    prisma.user.findUnique.mockResolvedValueOnce(localUser); // by email

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => createPayload({
        email: localUser.email,
        sub: 'google-conflict-1',
      }),
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'conflict-token' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: localUser.id },
      data: expect.objectContaining({
        googleId: 'google-conflict-1',
        provider: 'GOOGLE',
      }),
    });
  });

  it('retorna 401 quando verifyIdToken lança erro', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'));

    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_GOOGLE_TOKEN');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('retorna 400 quando email não está verificado', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => createPayload({ email_verified: false }),
    });

    const { csrfToken, csrfCookie } = await getCsrfToken();

    const res = await request(app)
      .post('/api/auth/google')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credential: 'unverified-email-token' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
