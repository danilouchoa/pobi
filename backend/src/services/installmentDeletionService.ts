import { Prisma } from '@prisma/client';
import type { PrismaClientLike } from '../types/prisma';

const INSTALLMENT_SEPARATOR_REGEX = /^(\d+)\s*\/\s*(\d+)$/;
const DESCRIPTION_INSTALLMENT_REGEX = /^(.*?)(?:\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*)$/;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type ExpenseRecord = {
  id: string;
  description: string;
  parcela: string | null;
  amount: string;
  originId: string | null;
  debtorId: string | null;
  installments: number | null;
  date: Date;
  billingMonth: string | null;
  fingerprint: string | null;
  installmentGroupId: string | null;
};

type DeleteCascadeResult = {
  deleted: ExpenseRecord[];
};

type PrismaExecutor = PrismaClientLike | Prisma.TransactionClient;

const normalizeParcela = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const extractInstallmentInfo = (expense: ExpenseRecord) => {
  const parcela = normalizeParcela(expense.parcela);
  if (!parcela) return null;
  const match = parcela.match(INSTALLMENT_SEPARATOR_REGEX);
  if (!match) return null;
  const total = Number(match[2]);
  if (!Number.isFinite(total) || total <= 1) return null;
  const descriptionMatch = expense.description.match(DESCRIPTION_INSTALLMENT_REGEX);
  const baseDescription = descriptionMatch ? descriptionMatch[1].trim() : expense.description.trim();
  return {
    total,
    baseDescription,
  } as const;
};

const buildGroupFilter = (userId: string, expense: ExpenseRecord) => {
  const info = extractInstallmentInfo(expense);
  if (!info) return null;

  const totalInstallments = expense.installments ?? info.total;

  const where: Prisma.ExpenseWhereInput = {
    userId,
    parcela: { endsWith: `/${info.total}` },
    amount: expense.amount,
  };

  if (totalInstallments && totalInstallments > 1) {
    where.installments = totalInstallments;
  }

  // Use fingerprint to restrict cascade to a single installment series
  // This prevents deleting unrelated installments with identical description/amount
  if (expense.fingerprint) {
    const fingerprintPrefix = expense.fingerprint.split('-')[0];
    if (fingerprintPrefix && fingerprintPrefix.length >= 8) {
      where.fingerprint = { startsWith: fingerprintPrefix };
    }
  }

  if (expense.originId !== null && expense.originId !== undefined) {
    where.originId = expense.originId;
  } else {
    where.originId = { equals: null };
  }

  if (expense.debtorId !== null && expense.debtorId !== undefined) {
    where.debtorId = expense.debtorId;
  } else {
    where.debtorId = { equals: null };
  }

  const pattern = new RegExp(
    `^${escapeRegex(info.baseDescription)}\\s*\\(\\s*\\d+\\s*/\\s*${info.total}\\s*\\)\\s*$`,
    'i'
  );

  return { where, info, pattern } as const;
};

export async function deleteExpenseById(
  prisma: PrismaClientLike,
  userId: string,
  expenseId: string
): Promise<DeleteCascadeResult | null> {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
    select: {
      id: true,
      description: true,
      parcela: true,
      amount: true,
      originId: true,
      debtorId: true,
      installments: true,
      date: true,
      billingMonth: true,
      fingerprint: true,
      installmentGroupId: true,
    },
  });

  if (!expense) {
    return null;
  }

  return prisma.$transaction((tx) => deleteExpenseCascade(tx, userId, expense as any));
}

export async function deleteSingleExpense(
  prisma: PrismaExecutor,
  userId: string,
  target: string | ExpenseRecord
): Promise<ExpenseRecord | null> {
  const expense =
    typeof target === 'string'
      ? await prisma.expense.findFirst({
          where: { id: target, userId },
          select: {
            id: true,
            description: true,
            parcela: true,
            amount: true,
            originId: true,
            debtorId: true,
            installments: true,
            date: true,
            billingMonth: true,
            fingerprint: true,
            installmentGroupId: true,
          },
        })
      : target;

  if (!expense) {
    return null;
  }

  const deleted = await prisma.expense.deleteMany({ where: { id: expense.id, userId } });
  if (!deleted.count) {
    return null;
  }
  return expense as ExpenseRecord;
}

export async function deleteExpenseCascade(
  prisma: PrismaExecutor,
  userId: string,
  expense: ExpenseRecord
): Promise<DeleteCascadeResult> {
  if (expense.installmentGroupId) {
    const related = await prisma.expense.findMany({
      where: {
        userId,
        installmentGroupId: expense.installmentGroupId,
      },
      select: {
        id: true,
        description: true,
        parcela: true,
        amount: true,
        originId: true,
        debtorId: true,
        installments: true,
        date: true,
        billingMonth: true,
        fingerprint: true,
        installmentGroupId: true,
      },
    });

    if (!related.length) {
      const deleted = await prisma.expense.deleteMany({
        where: { id: expense.id, userId },
      });
      return { deleted: deleted.count ? [expense] : [] };
    }

    await prisma.expense.deleteMany({
      where: {
        userId,
        installmentGroupId: expense.installmentGroupId,
      },
    });

    return {
      deleted: related.map((record) => ({
        id: record.id,
        description: record.description,
        parcela: record.parcela,
        amount: record.amount,
        originId: record.originId,
        debtorId: record.debtorId,
        installments: record.installments,
        date: record.date,
        billingMonth: record.billingMonth,
        fingerprint: record.fingerprint,
        installmentGroupId: record.installmentGroupId,
      })),
    };
  }

  const groupFilter = buildGroupFilter(userId, expense);

  if (!groupFilter) {
    const deleted = await prisma.expense.deleteMany({
      where: { id: expense.id, userId },
    });
    return { deleted: deleted.count ? [expense] : [] };
  }

  const candidates = await prisma.expense.findMany({
    where: groupFilter.where,
    select: {
      id: true,
      description: true,
      parcela: true,
      amount: true,
      originId: true,
      debtorId: true,
      installments: true,
      date: true,
      billingMonth: true,
      fingerprint: true,
      installmentGroupId: true,
    },
  });

  // Se alguma das candidatas já tiver installmentGroupId definido, use-o para
  // apagar todas as parcelas diretamente pelo agrupamento persistido em banco.
  const candidateWithGroupId = candidates.find(
    (record) => !!record.installmentGroupId
  );

  if (candidateWithGroupId?.installmentGroupId) {
    const related = await prisma.expense.findMany({
      where: { userId, installmentGroupId: candidateWithGroupId.installmentGroupId },
      select: {
        id: true,
        description: true,
        parcela: true,
        amount: true,
        originId: true,
        debtorId: true,
        installments: true,
        date: true,
        billingMonth: true,
        fingerprint: true,
        installmentGroupId: true,
      },
    });

    if (related.length) {
      await prisma.expense.deleteMany({
        where: { userId, installmentGroupId: candidateWithGroupId.installmentGroupId },
      });

      return {
        deleted: related.map((record) => ({
          id: record.id,
          description: record.description,
          parcela: record.parcela,
          amount: record.amount,
          originId: record.originId,
          debtorId: record.debtorId,
          installments: record.installments,
          date: record.date,
          billingMonth: record.billingMonth,
          fingerprint: record.fingerprint,
          installmentGroupId: record.installmentGroupId,
        })),
      };
    }
  }

  let related = candidates.filter((record) =>
    groupFilter.pattern.test(record.description ?? '')
  );

  // Alguns lançamentos antigos podem não ter a descrição no formato "(1/12)".
  // Se nada casar pelo padrão, caia para todos os candidatos filtrados pelo
  // restante dos campos (parcela, amount, origem/devedor, fingerprint etc.).
  if (!related.length && candidates.length) {
    related = candidates;
  }

  if (!related.length) {
    const deleted = await prisma.expense.deleteMany({
      where: { id: expense.id, userId },
    });
    return { deleted: deleted.count ? [expense] : [] };
  }

  const hasGroup =
    related.length > 1 ||
    (related.length === 1 && related[0].id === expense.id);

  if (!hasGroup) {
    const deleted = await prisma.expense.deleteMany({
      where: { id: expense.id, userId },
    });
    return { deleted: deleted.count ? [expense] : [] };
  }

  const idsToDelete = related.map((record) => record.id);

  await prisma.expense.deleteMany({
    where: {
      id: { in: idsToDelete },
      userId,
    },
  });

  return {
    deleted: related.map((record) => ({
      id: record.id,
      description: record.description,
      parcela: record.parcela,
      amount: record.amount,
      originId: record.originId,
      debtorId: record.debtorId,
      installments: record.installments,
      date: record.date,
      billingMonth: record.billingMonth,
      fingerprint: record.fingerprint,
      installmentGroupId: record.installmentGroupId,
    })),
  };
}
