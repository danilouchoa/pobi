import { PrismaClient } from '@prisma/client';
import { generateFingerprint } from '../src/utils/expenseHelpers';

const prisma = new PrismaClient();

async function main() {
  const allExpenses = await prisma.expense.findMany();
  const expenses = allExpenses.filter(
    (expense) => !expense.fingerprint || expense.fingerprint.trim() === ''
  );

  console.log(`🔍 Encontradas ${expenses.length} despesas sem fingerprint.`);

  let updatedCount = 0;
  for (const expense of expenses) {
    const fingerprint = generateFingerprint(
      `${expense.userId}-${expense.description}-${expense.date}`
    );
    await prisma.expense.update({
      where: { id: expense.id },
      data: { fingerprint },
    });
    updatedCount += 1;
  }

  console.log(`✅ Fingerprints preenchidos com sucesso. Total atualizadas: ${updatedCount}.`);
}

main()
  .catch((err) => {
    console.error('❌ Erro ao preencher fingerprints:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
