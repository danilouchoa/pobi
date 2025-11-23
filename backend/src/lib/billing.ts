/**
 * billing.ts
 * Utilitários para cálculo de fatura de cartão de crédito (billingMonth)
 * 
 * Este módulo contém funções essenciais para determinar o mês correto de faturamento
 * de despesas realizadas com cartão de crédito, considerando:
 * - Dia de fechamento da fatura (closingDay)
 * - Ajuste automático para dia útil quando o fechamento cai em fim de semana
 * - Políticas de rollover (NEXT ou PREVIOUS) para determinar a fatura correta
 * 
 * Exemplo de fluxo completo:
 * 1. Compra realizada em 08/11/2025 (quinta-feira)
 * 2. Cartão configurado com fechamento no dia 09 (sábado)
 * 3. Policy PREVIOUS: ajusta fechamento para sexta 07/11 (dia útil anterior)
 * 4. Como compra (08) foi DEPOIS do fechamento ajustado (07), vai para fatura de DEZEMBRO/2025
 * 
 * Integração:
 * - backend/src/routes/expenses.ts: Cálculo automático de billingMonth ao criar/editar despesa
 * - backend/scripts/backfill-billing-month.ts: Preenchimento retroativo de despesas antigas
 */

import { addDays, isSaturday, isSunday } from "date-fns";

/**
 * Políticas de virada de fatura quando o fechamento cai em fim de semana
 * 
 * - NEXT: Adiar fechamento para próxima segunda-feira
 *   Exemplo: Fechamento dia 09 (sábado) → move para 11 (segunda)
 *   Efeito: Compras do final de semana entram na fatura ATUAL (fecha mais tarde)
 * 
 * - PREVIOUS: Antecipar fechamento para sexta-feira anterior
 *   Exemplo: Fechamento dia 09 (sábado) → move para 07 (sexta)
 *   Efeito: Compras do final de semana vão para fatura SEGUINTE (fecha mais cedo)
 * 
 * A política PREVIOUS é mais comum em bancos brasileiros.
 * 
 * NOTA: Os valores devem corresponder ao enum BillingRolloverPolicy no schema.prisma
 */
export type BillingRolloverPolicy = "NEXT" | "PREVIOUS";

/**
 * Ajusta uma data de fechamento para o dia útil mais próximo
 * quando cai em sábado ou domingo, de acordo com a política escolhida.
 * 
 * @param date - Data original de fechamento (pode ser qualquer dia da semana)
 * @param policy - Política de ajuste: 'NEXT' (adiar) ou 'PREVIOUS' (antecipar)
 * @returns Data ajustada para dia útil (nunca retorna sábado/domingo)
 * 
 * @example
 * // Caso 1: Sábado com PREVIOUS (padrão brasileiro)
 * const closing = new Date(2025, 10, 9); // 09/11/2025 (sábado)
 * const adjusted = adjustToBusinessDay(closing, 'PREVIOUS');
 * // Retorna: 07/11/2025 (sexta-feira - volta 1 dia)
 * 
 * @example
 * // Caso 2: Domingo com PREVIOUS
 * const closing = new Date(2025, 10, 10); // 10/11/2025 (domingo)
 * const adjusted = adjustToBusinessDay(closing, 'PREVIOUS');
 * // Retorna: 08/11/2025 (sexta-feira - volta 2 dias)
 * 
 * @example
 * // Caso 3: Sábado com NEXT
 * const closing = new Date(2025, 10, 9); // 09/11/2025 (sábado)
 * const adjusted = adjustToBusinessDay(closing, 'NEXT');
 * // Retorna: 11/11/2025 (segunda-feira - avança 2 dias)
 */
export function adjustToBusinessDay(
  date: Date,
  policy: BillingRolloverPolicy = "PREVIOUS"
): Date {
  if (isSaturday(date)) {
    // Sábado: NEXT → segunda (+2 dias) | PREVIOUS → sexta (-1 dia)
    return policy === "NEXT" ? addDays(date, 2) : addDays(date, -1);
  }
  if (isSunday(date)) {
    // Domingo: NEXT → segunda (+1 dia) | PREVIOUS → sexta (-2 dias)
    return policy === "NEXT" ? addDays(date, 1) : addDays(date, -2);
  }
  // Já é dia útil (segunda a sexta), retorna data original
  return date;
}

/**
 * Calcula a data efetiva de fechamento da fatura para um determinado mês,
 * já ajustada para dia útil conforme a política.
 * 
 * Esta função cria a data de fechamento em UTC para evitar problemas de timezone
 * e aplica o ajuste de dia útil automaticamente.
 * 
 * @param year - Ano (ex: 2025)
 * @param month - Mês (1-12, diferente do Date que usa 0-11)
 * @param closingDay - Dia de fechamento (1-31)
 * @param policy - Política de rollover para finais de semana
 * @returns Date object representando o fechamento ajustado (UTC, 23:59:59.999)
 * 
 * @example
 * // Fechamento dia 09 de novembro/2025 (sábado) com PREVIOUS
 * const closing = getEffectiveClosingDate(2025, 11, 9, 'PREVIOUS');
 * // 1. Cria: 09/11/2025 23:59:59.999 UTC
 * // 2. Detecta: é sábado
 * // 3. Ajusta: 07/11/2025 23:59:59.999 UTC (sexta)
 */
export function getEffectiveClosingDate(
  year: number,
  month: number,
  closingDay: number,
  policy: BillingRolloverPolicy
): Date {
  // Criar data de fechamento no final do dia em UTC
  // Exemplo: 09/11/2025 23:59:59.999
  const base = new Date(Date.UTC(year, month - 1, closingDay, 23, 59, 59, 999));
  
  // Ajustar para dia útil se cair em fim de semana
  return adjustToBusinessDay(base, policy);
}

/**
 * Formata ano e mês para o padrão billingMonth (YYYY-MM)
 * 
 * @param year - Ano com 4 dígitos (ex: 2025)
 * @param month - Mês de 1 a 12 (janeiro = 1)
 * @returns String formatada 'YYYY-MM' (ex: "2025-11")
 * 
 * @example
 * formatYearMonth(2025, 11); // "2025-11"
 * formatYearMonth(2025, 1);  // "2025-01"
 */
const formatYearMonth = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

/**
 * Determina o mês de faturamento (billingMonth) para uma despesa de cartão de crédito,
 * baseado na data da transação, dia de fechamento e política de virada.
 * 
 * Algoritmo de cálculo (UTC-based para consistência):
 * 1. Extrai ano e mês da data da transação (em UTC)
 * 2. Calcula data de fechamento para aquele mês usando closingDay
 * 3. Ajusta fechamento para dia útil se cair em fim de semana
 * 4. Compara timestamp da transação com fechamento ajustado:
 *    - Transação <= fechamento → fatura do MÊS ATUAL (mesmo mês da compra)
 *    - Transação > fechamento → fatura do MÊS SEGUINTE (compra após corte)
 * 5. Retorna string formatada 'YYYY-MM' representando o mês da fatura
 * 
 * @param txDate - Data da compra/despesa (Date object)
 * @param closingDay - Dia de fechamento do cartão (1-31, configurado por cartão)
 * @param policy - Política de virada ('NEXT' ou 'PREVIOUS')
 * @returns String no formato 'YYYY-MM' indicando o mês da fatura
 * 
 * @example
 * // Cenário 1: Compra ANTES do fechamento (entra na fatura do mês corrente)
 * const txDate = new Date(Date.UTC(2025, 10, 5)); // 05/11/2025 UTC
 * const billingMonth = deriveBillingMonth(txDate, 9, 'PREVIOUS');
 * 
 * // Passo a passo:
 * // 1. Fechamento configurado: dia 09 de novembro
 * // 2. 09/11/2025 cai no sábado → ajusta para 07/11/2025 23:59 (sexta)
 * // 3. Compara timestamps: 05/11 00:00 <= 07/11 23:59 (compra ANTES do fechamento)
 * // 4. Resultado: "2025-11" (fatura de novembro/2025)
 * 
 * @example
 * // Cenário 2: Compra DEPOIS do fechamento (entra na fatura do próximo mês)
 * const txDate = new Date(Date.UTC(2025, 10, 8)); // 08/11/2025 UTC
 * const billingMonth = deriveBillingMonth(txDate, 9, 'PREVIOUS');
 * 
 * // Passo a passo:
 * // 1. Fechamento: 09/11 (sábado) → ajusta para 07/11 23:59 (sexta)
 * // 2. Compara: 08/11 00:00 > 07/11 23:59 (compra DEPOIS do fechamento)
 * // 3. Resultado: "2025-12" (fatura de dezembro/2025)
 * 
 * @example
 * // Cenário 3: Virada de ano (dezembro → janeiro)
 * const txDate = new Date(Date.UTC(2025, 11, 15)); // 15/12/2025 UTC
 * const billingMonth = deriveBillingMonth(txDate, 10, 'PREVIOUS');
 * 
 * // Passo a passo:
 * // 1. Fechamento: 10/12/2025
 * // 2. Compara: 15/12 > 10/12 (após fechamento)
 * // 3. Avança para próximo mês → janeiro/2026
 * // 4. Resultado: "2026-01" (fatura de janeiro do ano seguinte)
 */
export function deriveBillingMonth(
  txDate: Date,
  closingDay: number,
  policy: BillingRolloverPolicy
): string {
  // 1. Extrair ano e mês da transação (UTC para evitar problemas de timezone)
  const year = txDate.getUTCFullYear();
  const month = txDate.getUTCMonth() + 1; // Converter de 0-indexed (0-11) para 1-indexed (1-12)

  // 2. Calcular data de fechamento ajustada para o mês da transação
  // Exemplo: ano=2025, month=11, closingDay=9 → 09/11/2025 23:59 UTC, ajustado para sexta
  const closingDate = getEffectiveClosingDate(year, month, closingDay, policy);

  // 3. Comparar timestamps: transação vs fechamento
  // Se compra foi DEPOIS do fechamento, vai para fatura do PRÓXIMO MÊS
  if (txDate.getTime() > closingDate.getTime()) {
    // Avançar para próximo mês
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return formatYearMonth(nextYear, nextMonth);
  }

  // Compra foi ATÉ o fechamento → fatura do MÊS ATUAL
  return formatYearMonth(year, month);
}
