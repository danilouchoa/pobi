import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { deriveBillingMonth, BillingRolloverPolicy } from '../src/lib/billing';
import { invalidateExpenseCache } from '../src/utils/expenseCache';

const prisma = new PrismaClient();

const normalizeType = (value?: string | null) =>
  value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

const isCard = (type?: string | null) => normalizeType(type) === 'cartao';

async function main() {
  const origins = await prisma.origin.findMany({
    where: { closingDay: { not: null }, active: { not: false } },
    select: {
      id: true,
      userId: true,
      type: true,
      closingDay: true,
      billingRolloverPolicy: true,
    },
  });

  const cardOrigins = origins.filter((origin) => isCard(origin.type));

  let updated = 0;
  const invalidations = new Map<string, Set<string>>();

  for (const origin of cardOrigins) {
    if (!origin.closingDay) continue;
    const expenses = await prisma.expense.findMany({
      where: { originId: origin.id, billingMonth: null },
      select: { id: true, date: true, userId: true },
    });

    for (const expense of expenses) {
      const billingMonth = deriveBillingMonth(
        new Date(expense.date),
        origin.closingDay,
        (origin.billingRolloverPolicy ?? 'NEXT_BUSINESS_DAY') as BillingRolloverPolicy
      );

      await prisma.expense.update({
        where: { id: expense.id },
        data: { billingMonth },
      });

      invalidations.set(expense.userId, invalidations.get(expense.userId) ?? new Set());
      invalidations.get(expense.userId)!.add(billingMonth);
      updated += 1;
    }
  }

  for (const [userId, months] of invalidations.entries()) {
    const entries = Array.from(months).map((month) => ({ month, mode: 'billing' as const }));
    await invalidateExpenseCache(userId, entries);
  }

  console.log(`Backfill concluído. Despesas atualizadas: ${updated}`);
}

main()
  .catch((error) => {
    console.error('Erro ao executar backfill de billingMonth:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
