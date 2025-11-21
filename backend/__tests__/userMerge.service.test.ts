import { describe, it, expect, vi } from 'vitest';
import { PrismaClient, Provider } from '@prisma/client';
import { mergeUsersUsingGoogleAsCanonical } from '../src/services/userMerge';

const prisma = new PrismaClient() as any;

describe('mergeUsersUsingGoogleAsCanonical', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mover relacionamentos e remove usuário LOCAL ao final', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'local-user',
        email: 'local@finance.app',
        provider: Provider.LOCAL,
        googleId: null,
        passwordHash: 'hash-local',
        name: 'Local User',
        avatar: null,
      })
      .mockResolvedValueOnce({
        id: 'google-user',
        email: 'google@finance.app',
        provider: Provider.GOOGLE,
        googleId: 'google-123',
        passwordHash: null,
        name: 'Google User',
        avatar: null,
      });

    prisma.origin.updateMany.mockResolvedValue({ count: 2 });
    prisma.debtor.updateMany.mockResolvedValue({ count: 1 });
    prisma.expense.updateMany.mockResolvedValue({ count: 3 });
    prisma.salaryHistory.updateMany.mockResolvedValue({ count: 1 });
    prisma.job.updateMany.mockResolvedValue({ count: 4 });

    prisma.user.update.mockResolvedValue({
      id: 'google-user',
      email: 'google@finance.app',
      provider: Provider.GOOGLE,
      googleId: 'google-123',
      passwordHash: 'hash-local',
      name: 'Google User',
      avatar: null,
    });

    prisma.user.delete.mockResolvedValue({ id: 'local-user' });

    const result = await mergeUsersUsingGoogleAsCanonical(prisma, {
      localUserId: 'local-user',
      googleUserId: 'google-user',
    });

    expect(result.moved).toEqual({
      origins: 2,
      debtors: 1,
      expenses: 3,
      salaryHistory: 1,
      jobs: 4,
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'local-user' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'google-user' },
      data: expect.objectContaining({
        provider: Provider.GOOGLE,
        passwordHash: 'hash-local',
      }),
    });
  });

  it('lança erro quando ids são iguais', async () => {
    await expect(
      mergeUsersUsingGoogleAsCanonical(prisma, {
        localUserId: 'same',
        googleUserId: 'same',
      }),
    ).rejects.toThrow();
  });
});
