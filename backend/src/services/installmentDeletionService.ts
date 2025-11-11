import { Prisma, PrismaClient } from '@prisma/client';

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
};

type DeleteCascadeResult = {
  deleted: ExpenseRecord[];
};

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

export async function deleteExpenseCascade(
  prisma: PrismaClient,
  userId: string,
  expense: ExpenseRecord
): Promise<DeleteCascadeResult> {
  const groupFilter = buildGroupFilter(userId, expense);

  if (!groupFilter) {
    await prisma.expense.delete({ where: { id: expense.id } });
    return { deleted: [expense] };
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
    },
  });

  const related = candidates.filter((record) =>
    groupFilter.pattern.test(record.description ?? '')
  );

  if (!related.length) {
    await prisma.expense.delete({ where: { id: expense.id } });
    return { deleted: [expense] };
  }

  const hasGroup =
    related.length > 1 ||
    (related.length === 1 && related[0].id === expense.id);

  if (!hasGroup) {
    await prisma.expense.delete({ where: { id: expense.id } });
    return { deleted: [expense] };
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
    })),
  };
}
