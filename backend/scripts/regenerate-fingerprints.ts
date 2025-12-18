import { PrismaClient } from '@prisma/client';
import { generateFingerprint } from '../src/utils/expenseHelpers';

const prisma = new PrismaClient();

async function main() {
  const expenses = await prisma.expense.findMany();
  console.log(`🔄 Regenerando fingerprints para ${expenses.length} despesas...`);

  let updated = 0;

  for (const expense of expenses) {
    const seed = [
      expense.userId,
      expense.description,
      expense.date instanceof Date ? expense.date.toISOString() : String(expense.date),
      expense.amount,
      expense.originId ?? '-',
      expense.debtorId ?? '-',
    ].join('|');

    const fingerprint = generateFingerprint(seed);

    await prisma.expense.update({
      where: { id: expense.id },
      data: { fingerprint },
    });
    updated += 1;
  }

  console.log(`✅ Fingerprints atualizados para ${updated} despesas.`);
}

main()
  .catch((err) => {
    console.error('❌ Erro ao regenerar fingerprints:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
