import { PrismaClient } from '@prisma/client';
import { addMonths, format } from 'date-fns';
import { generateFingerprint } from '../utils/expenseHelpers';
import { parseDecimal, toDecimalString } from '../utils/formatters';
import { buildInvalidationEntries, invalidateExpenseCache, monthKeyFromInput } from '../utils/expenseCache';

export async function processRecurringExpenses(prisma: PrismaClient) {
  const recurringExpenses = await prisma.expense.findMany({
    where: {
      OR: [{ recurring: true }, { fixed: true }],
    },
    orderBy: { date: 'asc' },
  });

  let created = 0;
  let skipped = 0;
  const invalidationByUser = new Map<string, Set<string>>();

  const queueInvalidation = (userId: string, calendarMonth: string | null, billingMonth: string | null) => {
    const entries = buildInvalidationEntries(calendarMonth, billingMonth);
    const bucket = invalidationByUser.get(userId) ?? new Set<string>();
    entries.forEach((entry) => {
      if (!entry.month) return;
      bucket.add(`${entry.mode}:${entry.month}`);
    });
    invalidationByUser.set(userId, bucket);
  };

  const now = new Date();
  for (const expense of recurringExpenses) {
    let lastReplicated = expense.lastReplicatedAt ?? expense.date;
    let nextReplicationDate = addMonths(new Date(lastReplicated), 1);
    let createdForExpense = 0;

    while (nextReplicationDate.getTime() <= now.getTime()) {
      const amountSeed = parseDecimal(expense.amount);
      const monthKey = format(nextReplicationDate, 'yyyy-MM');
      const fingerprintSeed = [
        expense.userId,
        monthKey,
        expense.description,
        amountSeed,
        expense.originId ?? '-',
        expense.debtorId ?? '-',
      ].join('|');
      const fingerprint = generateFingerprint(fingerprintSeed);
      const calendarMonth = monthKeyFromInput(nextReplicationDate);
      const billingMonth = expense.billingMonth ?? calendarMonth;

      await prisma.expense.create({
        data: {
          userId: expense.userId,
          description: expense.description,
          category: expense.category,
          parcela: expense.parcela,
          amount: toDecimalString(expense.amount ?? undefined),
          date: nextReplicationDate,
          originId: expense.originId,
          debtorId: expense.debtorId,
          recurring: expense.recurring,
          recurrenceType: expense.recurrenceType,
          fixed: expense.fixed,
          installments: expense.installments,
          sharedWith: expense.sharedWith,
          sharedAmount:
            expense.sharedAmount == null ? null : toDecimalString(expense.sharedAmount),
          billingMonth,
          fingerprint,
        },
      });

      queueInvalidation(expense.userId, calendarMonth, billingMonth);

      lastReplicated = nextReplicationDate;
      nextReplicationDate = addMonths(new Date(lastReplicated), 1);
      createdForExpense += 1;
      created += 1;
    }

    if (createdForExpense === 0) {
      skipped += 1;
      continue;
    }

    await prisma.expense.update({
      where: { id: expense.id },
      data: { lastReplicatedAt: lastReplicated },
    });
  }

  for (const [userId, months] of invalidationByUser.entries()) {
    const entries = Array.from(months.values()).map((token) => {
      const [mode, month] = token.split(':');
      return { month, mode: mode as 'calendar' | 'billing' };
    });
    await invalidateExpenseCache(userId, entries);
  }

  return { created, skipped };
}
