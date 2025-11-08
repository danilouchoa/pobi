import { Prisma, PrismaClient } from '@prisma/client';
import { BulkUpdateInput } from '../schemas/bulkUpdate.schema';
import {
  buildInvalidationEntries,
  invalidateExpenseCache,
  monthKeyFromInput,
} from '../utils/expenseCache';

export type BulkUpdateJob = {
  jobId: string;
  userId: string;
  expenseIds: string[];
  payload: BulkUpdateInput['data'];
};

const buildUpdateManyData = (
  payload: BulkUpdateInput['data']
): { data: Prisma.ExpenseUpdateManyMutationInput; hasData: boolean } => {
  const data: Prisma.ExpenseUpdateManyMutationInput = {};
  let hasData = false;

  if (payload.category !== undefined) {
    data.category = payload.category;
    hasData = true;
  }
  if (payload.fixed !== undefined) {
    data.fixed = payload.fixed;
    hasData = true;
  }
  if (payload.recurring !== undefined) {
    data.recurring = payload.recurring;
    data.recurrenceType = payload.recurring
      ? payload.recurrenceType ?? 'monthly'
      : null;
    hasData = true;
  } else if (payload.recurrenceType !== undefined) {
    data.recurrenceType = payload.recurrenceType;
    hasData = true;
  }

  return { data, hasData };
};

export async function applyBulkUpdate(prisma: PrismaClient, job: BulkUpdateJob) {
  if (!job.expenseIds.length) {
    return { count: 0 };
  }

  if (job.payload.originId) {
    const origin = await prisma.origin.findFirst({
      where: { id: job.payload.originId, userId: job.userId },
      select: { id: true },
    });
    if (!origin) {
      throw new Error('Origem inválida para o usuário.');
    }
  }

  const affectedRecords = await prisma.expense.findMany({
    where: { id: { in: job.expenseIds }, userId: job.userId },
    select: { id: true, date: true, billingMonth: true },
  });

  if (!affectedRecords.length) {
    return { count: 0 };
  }

  const targetIds = affectedRecords.map((record) => record.id);
  const { data: updateManyData, hasData } = buildUpdateManyData(job.payload);

  let updatedCount = 0;
  if (hasData) {
    const result = await prisma.expense.updateMany({
      where: { id: { in: targetIds }, userId: job.userId },
      data: updateManyData,
    });
    updatedCount += result.count;
  }

  if (job.payload.originId !== undefined) {
    await prisma.$transaction(
      targetIds.map((id) =>
        prisma.expense.update({
          where: { id },
          data: { originId: job.payload.originId },
        })
      )
    );
    updatedCount += targetIds.length;
  }

  const invalidationMap = new Map<string, { month: string; mode: 'calendar' | 'billing' }>();
  affectedRecords.forEach((record) => {
    const calendarMonth = monthKeyFromInput(record.date);
    const entries = buildInvalidationEntries(calendarMonth, record.billingMonth ?? null);
    entries.forEach((entry) => {
      if (!entry.month) return;
      const key = `${entry.mode}:${entry.month}`;
      if (!invalidationMap.has(key)) {
        invalidationMap.set(key, { month: entry.month, mode: entry.mode });
      }
    });
  });

  if (invalidationMap.size) {
    await invalidateExpenseCache(job.userId, Array.from(invalidationMap.values()));
  }

  return { count: updatedCount };
}
