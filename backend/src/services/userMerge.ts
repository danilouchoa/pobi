import { Provider, type User } from '@prisma/client';
import type { PrismaClientLike } from '../types/prisma';

type MergeStats = {
  movedOrigins: number;
  movedDebtors: number;
  movedExpenses: number;
  movedSalaryHistory: number;
  movedJobs: number;
};

export type MergeResult = {
  canonicalUser: User;
  stats: MergeStats;
};

/**
 * Move todos os relacionamentos do usuário LOCAL para o usuário GOOGLE (canônico).
 * O usuário local é removido ao final para evitar duplicidade de contas.
 */
export async function mergeUsersUsingGoogleAsCanonical(
  prisma: PrismaClientLike,
  { localUserId, googleUserId }: { localUserId: string; googleUserId: string },
): Promise<MergeResult> {
  if (localUserId === googleUserId) {
    throw new Error('localUserId and googleUserId must be different');
  }

  return prisma.$transaction(async (tx) => {
    const [localUser, googleUser] = await Promise.all([
      tx.user.findUnique({ where: { id: localUserId } }),
      tx.user.findUnique({ where: { id: googleUserId } }),
    ]);

    if (!localUser) {
      throw new Error('Local user not found');
    }

    if (!googleUser) {
      throw new Error('Google user not found');
    }

    const [origins, debtors, expenses, salaryHistory, jobs] = await Promise.all([
      tx.origin.updateMany({ where: { userId: localUser.id }, data: { userId: googleUser.id } }),
      tx.debtor.updateMany({ where: { userId: localUser.id }, data: { userId: googleUser.id } }),
      tx.expense.updateMany({ where: { userId: localUser.id }, data: { userId: googleUser.id } }),
      tx.salaryHistory.updateMany({ where: { userId: localUser.id }, data: { userId: googleUser.id } }),
      tx.job.updateMany({ where: { userId: localUser.id }, data: { userId: googleUser.id } }),
    ]);

    const updatedGoogleUser = await tx.user.update({
      where: { id: googleUser.id },
      data: {
        provider: Provider.GOOGLE,
        email: googleUser.email,
        name: googleUser.name ?? localUser.name ?? undefined,
        avatar: googleUser.avatar ?? localUser.avatar ?? undefined,
        passwordHash: googleUser.passwordHash ?? localUser.passwordHash ?? undefined,
      },
    });

    await tx.user.delete({ where: { id: localUser.id } });

    return {
      canonicalUser: updatedGoogleUser,
      stats: {
        movedOrigins: origins.count,
        movedDebtors: debtors.count,
        movedExpenses: expenses.count,
        movedSalaryHistory: salaryHistory.count,
        movedJobs: jobs.count,
      },
    };
  });
}
