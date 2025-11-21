import { PrismaClient, Provider, type User } from '@prisma/client';

type MergeStats = {
  origins: number;
  debtors: number;
  expenses: number;
  salaryHistory: number;
  jobs: number;
};

export type MergeResult = {
  user: User;
  moved: MergeStats;
};

/**
 * Move todos os relacionamentos do usuário LOCAL para o usuário GOOGLE (canônico).
 * O usuário local é removido ao final para evitar duplicidade de contas.
 */
export async function mergeUsersUsingGoogleAsCanonical(
  prisma: PrismaClient,
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
      user: updatedGoogleUser,
      moved: {
        origins: origins.count,
        debtors: debtors.count,
        expenses: expenses.count,
        salaryHistory: salaryHistory.count,
        jobs: jobs.count,
      },
    };
  });
}
