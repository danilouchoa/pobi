/**
 * backfill-billing-month.ts
 * 
 * Script de migração/backfill para preencher o campo billingMonth em despesas antigas
 * que foram criadas antes da implementação da Milestone #0.
 * 
 * Objetivo:
 * - Iterar todas as origens do tipo "Cartão" que têm closingDay configurado
 * - Para cada cartão, buscar despesas SEM billingMonth preenchido
 * - Calcular billingMonth retroativamente usando deriveBillingMonth()
 * - Atualizar despesas em batch para performance
 * - Invalidar cache Redis para forçar re-fetch
 * - Logar progresso detalhado para auditoria
 * 
 * Uso:
 * ```bash
 * npm run billing:backfill
 * # ou
 * docker exec finance_backend npm run billing:backfill
 * ```
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { deriveBillingMonth, BillingRolloverPolicy } from '../src/lib/billing';
import { invalidateExpenseCache } from '../src/utils/expenseCache';

const prisma = new PrismaClient();

/**
 * Normaliza tipo de origin para comparação case-insensitive
 * Remove acentos e converte para minúsculas
 */
const normalizeType = (value?: string | null) =>
  value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

/**
 * Verifica se uma origin é do tipo Cartão de Crédito
 */
const isCard = (type?: string | null) => normalizeType(type) === 'cartao';

async function main() {
  console.log('\n[Backfill] 🚀 Iniciando backfill de billingMonth...\n');

  // 1. Buscar todas as origens (cartões) com closingDay configurado
  const origins = await prisma.origin.findMany({
    where: { closingDay: { not: null }, active: { not: false } },
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      closingDay: true,
      billingRolloverPolicy: true,
    },
  });

  // 2. Filtrar apenas cartões de crédito
  const cardOrigins = origins.filter((origin) => isCard(origin.type));

  console.log(`[Backfill] 📊 Encontrados ${cardOrigins.length} cartão(ões) com closingDay configurado\n`);

  if (cardOrigins.length === 0) {
    console.log('[Backfill] ⚠️  Nenhum cartão encontrado. Nada a fazer.');
    return;
  }

  let updated = 0;
  
  // Map para rastrear invalidações de cache por usuário
  // userId → Set<billingMonth>
  const invalidations = new Map<string, Set<string>>();

  // 3. Processar cada cartão
  for (const origin of cardOrigins) {
    if (!origin.closingDay) continue;

    console.log(`[Backfill] 💳 Processando: ${origin.name || origin.id}`);
    console.log(`[Backfill]    Fechamento: dia ${origin.closingDay}`);
    console.log(`[Backfill]    Policy: ${origin.billingRolloverPolicy || 'PREVIOUS (padrão)'}`);

    // 4. Buscar despesas deste cartão SEM billingMonth
    const expenses = await prisma.expense.findMany({
      where: { originId: origin.id, billingMonth: null },
      select: { id: true, date: true, userId: true },
    });

    console.log(`[Backfill]    → ${expenses.length} despesa(s) sem billingMonth`);

    // 5. Calcular e atualizar billingMonth para cada despesa
    for (const expense of expenses) {
      // Usar política configurada ou PREVIOUS como padrão (padrão brasileiro)
      const billingMonth = deriveBillingMonth(
        new Date(expense.date),
        origin.closingDay,
        (origin.billingRolloverPolicy ?? 'PREVIOUS') as BillingRolloverPolicy
      );

      // Atualizar despesa
      await prisma.expense.update({
        where: { id: expense.id },
        data: { billingMonth },
      });

      // Rastrear invalidações de cache
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
