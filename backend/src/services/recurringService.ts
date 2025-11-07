import { PrismaClient } from '@prisma/client';
import { addMonths, format } from 'date-fns';
import { generateFingerprint } from '../utils/expenseHelpers';
import { parseDecimal, toDecimalString } from '../utils/formatters';

export async function processRecurringExpenses(prisma: PrismaClient) {
  const recurringExpenses = await prisma.expense.findMany({
    where: {
      OR: [{ recurring: true }, { fixed: true }],
    },
    orderBy: { date: 'asc' },
  });

  let created = 0;
  let skipped = 0;

  for (const expense of recurringExpenses) {
    const now = new Date();
    const baseDate = expense.lastReplicatedAt ?? expense.date;
    const nextReplicationDate = addMonths(new Date(baseDate), 1);
    const shouldReplicate = nextReplicationDate.getTime() <= now.getTime();

    if (!shouldReplicate) {
      skipped += 1;
      continue;
    }

    const amountSeed = parseDecimal(expense.amount);
    const sharedSeed = expense.sharedAmount != null ? parseDecimal(expense.sharedAmount) : 0;
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
        fingerprint,
      },
    });

    await prisma.expense.update({
      where: { id: expense.id },
      data: { lastReplicatedAt: now },
    });
    created += 1;
  }

  return { created, skipped };
}
