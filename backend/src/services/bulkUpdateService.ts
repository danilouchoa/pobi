import { Prisma, PrismaClient } from '@prisma/client';
import { BulkUpdateData, BulkUnifiedUpdateItem } from '../schemas/bulkUpdate.schema';
import {
  buildInvalidationEntries,
  invalidateExpenseCache,
  monthKeyFromInput,
} from '../utils/expenseCache';
import { deleteExpenseCascade } from './installmentDeletionService';

export type BulkUpdateJob = {
  jobId: string;
  userId: string;
  expenseIds: string[];
  payload: BulkUpdateData;
};

const buildUpdateManyData = (
  payload: BulkUpdateData
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

// ------------------------------
// Novo helper: aplica "update" item-a-item (payload.items) do endpoint unificado
// ------------------------------
export async function applyBulkUnifiedUpdate(
  prisma: PrismaClient,
  userId: string,
  items: BulkUnifiedUpdateItem[]
) {
  // Evita N+1: busca todas as despesas alvo de uma vez
  const targetIds = items.map(i => i.id);
  const existingExpenses = await prisma.expense.findMany({
    where: { id: { in: targetIds }, userId },
    select: { id: true, date: true, billingMonth: true },
  });

  const expenseMap = new Map<string, typeof existingExpenses[0]>();
  existingExpenses.forEach(e => expenseMap.set(e.id, e));

  // Validar ownership de originId quando informado
  const candidateOriginIds = Array.from(
    new Set(
      items
        .map((i) => i.originId)
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
    )
  );
  let allowedOriginIds = new Set<string>();
  if (candidateOriginIds.length) {
    const rows = await prisma.origin.findMany({
      where: { id: { in: candidateOriginIds }, userId },
      select: { id: true },
    });
    allowedOriginIds = new Set(rows.map((r) => r.id));
  }

  let updatedCount = 0;
  const invalidationMap = new Map<string, { month: string; mode: 'calendar' | 'billing' }>();

  for (const item of items) {
    const expense = expenseMap.get(item.id);
    if (!expense) continue; // ignora ids inválidos / pertencentes a outro usuário

    const updateData: Prisma.ExpenseUpdateInput = {};
    if (item.category !== undefined) updateData.category = item.category;
    if (item.fixed !== undefined) updateData.fixed = item.fixed;
    if (item.recurring !== undefined) {
      updateData.recurring = item.recurring;
      updateData.recurrenceType = item.recurring ? item.recurrenceType ?? 'monthly' : null;
    } else if (item.recurrenceType !== undefined) {
      updateData.recurrenceType = item.recurrenceType;
    }
    if (item.originId !== undefined) {
      if (item.originId === null) {
        updateData.origin = { disconnect: true };
      } else {
        if (!allowedOriginIds.has(item.originId)) {
          throw new Error('Origem inválida para o usuário.');
        }
        updateData.origin = { connect: { id: item.originId } };
      }
    }

    if (Object.keys(updateData).length === 0) {
      // Nada para atualizar neste item
      continue;
    }

    await prisma.expense.update({ where: { id: expense.id }, data: updateData });
    updatedCount += 1; // Conta exatamente uma vez por item atualizado

    const calendarMonth = monthKeyFromInput(expense.date);
    const entries = buildInvalidationEntries(calendarMonth, expense.billingMonth ?? null);
    entries.forEach((entry) => {
      if (!entry.month) return;
      const key = `${entry.mode}:${entry.month}`;
      if (!invalidationMap.has(key)) {
        invalidationMap.set(key, { month: entry.month, mode: entry.mode });
      }
    });
  }

  if (invalidationMap.size) {
    await invalidateExpenseCache(userId, Array.from(invalidationMap.values()));
  }

  return { updatedCount };
}

// ------------------------------
// Novo helper: bulk delete do endpoint unificado
// ------------------------------
export async function applyBulkDelete(
  prisma: PrismaClient,
  userId: string,
  ids: string[]
) {
  if (!ids.length) return { deletedCount: 0 };

  const existing = await prisma.expense.findMany({
    where: { id: { in: ids }, userId },
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
  if (!existing.length) return { deletedCount: 0 };

  // Use cascade deletion for each expense to handle installment groups
  const allDeleted: any[] = [];
  const invalidationMap = new Map<string, { month: string; mode: 'calendar' | 'billing' }>();

  for (const expense of existing) {
    const cascadeResult = await deleteExpenseCascade(prisma, userId, expense as any);
    allDeleted.push(...cascadeResult.deleted);

    cascadeResult.deleted.forEach((deletedExpense) => {
      const calendarMonth = monthKeyFromInput(deletedExpense.date);
      const entries = buildInvalidationEntries(calendarMonth, deletedExpense.billingMonth ?? null);
      entries.forEach((entry) => {
        if (!entry.month) return;
        const key = `${entry.mode}:${entry.month}`;
        if (!invalidationMap.has(key)) {
          invalidationMap.set(key, { month: entry.month, mode: entry.mode });
        }
      });
    });
  }

  if (invalidationMap.size) {
    await invalidateExpenseCache(userId, Array.from(invalidationMap.values()));
  }

  return { deletedCount: allDeleted.length };
}
