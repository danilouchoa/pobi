import crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/config', () => ({
  config: {
    emailVerificationTokenTtlHours: 24,
    emailVerificationResendMinutes: 15,
  },
}));

import {
  EmailVerificationTokenStatus,
  canIssueNewToken,
  consumeToken,
  createEmailVerificationToken,
  resolveToken,
} from '../src/services/emailVerification';
import type { PrismaClient } from '@prisma/client';

const hash = (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

type MockToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  createdIp?: string | null;
};

type MockUser = {
  id: string;
  emailVerifiedAt: Date | null;
  emailVerifiedIp: string | null;
};

const buildMockPrisma = () => {
  const tokens: MockToken[] = [];
  const users: MockUser[] = [];

  const findToken = (predicate: (token: MockToken) => boolean) => tokens.find(predicate) ?? null;

  const prisma: any = {
    emailVerificationToken: {
      create: vi.fn(async ({ data }: any) => {
        const record: MockToken = {
          id: `evt-${tokens.length + 1}`,
          createdAt: new Date(),
          consumedAt: data.consumedAt ?? null,
          ...data,
        };
        tokens.push(record);
        return { ...record };
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any = {}) => {
        let filtered = tokens.filter((token) => {
          if (where?.tokenHash && token.tokenHash !== where.tokenHash) return false;
          if (where?.userId && token.userId !== where.userId) return false;
          if (where?.createdAt?.gte && token.createdAt < where.createdAt.gte) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          filtered = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return filtered[0] ? { ...filtered[0] } : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const token = findToken((t) => {
          if (where?.id && t.id !== where.id) return false;
          if (where?.tokenHash && t.tokenHash !== where.tokenHash) return false;
          return true;
        });
        if (!token) throw new Error('Token not found');
        Object.assign(token, data);
        return { ...token };
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        return users.find((u) => u.id === where?.id) ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.find((u) => u.id === where?.id);
        if (!user) throw new Error('User not found');
        Object.assign(user, data);
        return { ...user };
      }),
      create: vi.fn(async ({ data }: any) => {
        const user: MockUser = {
          id: data.id ?? `user-${users.length + 1}`,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          emailVerifiedIp: data.emailVerifiedIp ?? null,
        };
        users.push(user);
        return { ...user };
      }),
    },
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
  } as unknown as PrismaClient;

  return { prisma, tokens, users };
};

describe('emailVerification service', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  const fixedNow = new Date('2024-01-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    mockPrisma = buildMockPrisma();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a token with hashed value and future expiry', async () => {
    const { prisma, tokens } = mockPrisma;
    const result = await createEmailVerificationToken({ userId: 'user-1', createdIp: '127.0.0.1', prisma });

    expect(result.rawToken).toBeTruthy();
    expect(result.expiresAt.getTime()).toBe(new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000).getTime());
    expect(tokens).toHaveLength(1);
    expect(tokens[0].userId).toBe('user-1');
    expect(tokens[0].consumedAt).toBeNull();
    expect(tokens[0].tokenHash).toBe(hash(result.rawToken));
    expect(tokens[0].tokenHash).not.toBe(result.rawToken);
    expect(tokens[0].createdIp).toBe('127.0.0.1');
  });

  it('resolves a valid token', async () => {
    const { prisma } = mockPrisma;
    const { rawToken } = await createEmailVerificationToken({ userId: 'user-2', prisma });

    const outcome = await resolveToken(rawToken, { prisma });
    expect(outcome.status).toBe(EmailVerificationTokenStatus.Valid);
    if (outcome.status === EmailVerificationTokenStatus.Valid) {
      expect(outcome.token.userId).toBe('user-2');
    }
  });

  it('returns not_found for unknown tokens', async () => {
    const outcome = await resolveToken('non-existent', { prisma: mockPrisma.prisma });
    expect(outcome.status).toBe(EmailVerificationTokenStatus.NotFound);
  });

  it('returns expired for tokens past expiry', async () => {
    const { prisma, tokens } = mockPrisma;
    const { rawToken } = await createEmailVerificationToken({ userId: 'user-3', prisma });
    tokens[0].expiresAt = new Date(fixedNow.getTime() - 1000);

    const outcome = await resolveToken(rawToken, { prisma, now: new Date(fixedNow.getTime()) });
    expect(outcome.status).toBe(EmailVerificationTokenStatus.Expired);
  });

  it('consumes valid tokens and updates user verification info', async () => {
    const { prisma, users, tokens } = mockPrisma;
    await prisma.user.create({ data: { id: 'user-4', emailVerifiedAt: null, emailVerifiedIp: null } });
    const { rawToken } = await createEmailVerificationToken({ userId: 'user-4', prisma });

    const result = await consumeToken(rawToken, '10.0.0.1', { prisma });

    expect(result.status).toBe(EmailVerificationTokenStatus.Valid);
    expect(tokens[0].consumedAt).not.toBeNull();
    const user = users.find((u) => u.id === 'user-4');
    expect(user?.emailVerifiedAt).toEqual(fixedNow);
    expect(user?.emailVerifiedIp).toBe('10.0.0.1');
  });

  it('does not consume tokens twice', async () => {
    const { prisma } = mockPrisma;
    await prisma.user.create({ data: { id: 'user-5', emailVerifiedAt: null, emailVerifiedIp: null } });
    const { rawToken } = await createEmailVerificationToken({ userId: 'user-5', prisma });

    await consumeToken(rawToken, '10.0.0.2', { prisma });
    const secondAttempt = await consumeToken(rawToken, '10.0.0.3', { prisma });

    expect(secondAttempt.status).toBe(EmailVerificationTokenStatus.AlreadyUsed);
  });

  it('returns expired when attempting to consume expired tokens', async () => {
    const { prisma, tokens } = mockPrisma;
    await prisma.user.create({ data: { id: 'user-6', emailVerifiedAt: null, emailVerifiedIp: null } });
    const { rawToken } = await createEmailVerificationToken({ userId: 'user-6', prisma });
    tokens[0].expiresAt = new Date(fixedNow.getTime() - 1000);

    const result = await consumeToken(rawToken, '10.0.0.4', { prisma, now: fixedNow });
    expect(result.status).toBe(EmailVerificationTokenStatus.Expired);
  });

  it('returns not_found when consuming random tokens', async () => {
    const result = await consumeToken('random-token', null, { prisma: mockPrisma.prisma });
    expect(result.status).toBe(EmailVerificationTokenStatus.NotFound);
  });

  it('applies resend window restrictions in canIssueNewToken', async () => {
    const { prisma, tokens } = mockPrisma;
    await prisma.user.create({ data: { id: 'user-7', emailVerifiedAt: null, emailVerifiedIp: null } });
    await createEmailVerificationToken({ userId: 'user-7', prisma });

    const withinWindow = await canIssueNewToken('user-7', { prisma, now: fixedNow });
    expect(withinWindow.allowed).toBe(false);
    expect(withinWindow.reason).toBe('within_resend_window');

    tokens[0].createdAt = new Date(fixedNow.getTime() - 16 * 60 * 1000);
    const outsideWindow = await canIssueNewToken('user-7', { prisma, now: fixedNow });
    expect(outsideWindow.allowed).toBe(true);
    expect(outsideWindow.reason).toBe('outside_resend_window');
  });
});
