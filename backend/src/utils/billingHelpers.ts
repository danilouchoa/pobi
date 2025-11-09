/**
 * billingHelpers.ts
 * Utilitários para cálculo de fatura de cartão (billingMonth) e ajuste de datas para dias úteis.
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
 * 3. Sistema ajusta fechamento para sexta 07/11 (dia útil anterior)
 * 4. Como compra (08) foi DEPOIS do fechamento ajustado (07), vai para fatura de DEZEMBRO/2025
 * 
 * Integração:
 * - backend/src/routes/expenses.ts: Cálculo automático de billingMonth ao criar/editar despesa
 * - backend/scripts/backfill-billing-month.ts: Preenchimento retroativo de despesas antigas
 * - frontend: Agrupamento de despesas por fatura na UI
 */

import { addDays, subDays, isSaturday, isSunday, format } from 'date-fns';

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
 */
export type BillingRolloverPolicy = 'NEXT' | 'PREVIOUS';

/**
 * Ajusta a data de fechamento para o dia útil mais próximo
 * quando cai em sábado ou domingo, sempre movendo para SEXTA-FEIRA anterior.
 * 
 * Esta função implementa a política PREVIOUS (padrão brasileiro):
 * - Sábado → volta 1 dia → sexta-feira
 * - Domingo → volta 2 dias → sexta-feira
 * - Segunda a sexta → mantém data original
 * 
 * @param date - Data original de fechamento (pode ser qualquer dia da semana)
 * @returns Data ajustada para dia útil (nunca retorna sábado/domingo)
 * 
 * @example
 * // Caso 1: Fechamento cai no sábado
 * const closing = new Date(2025, 10, 9); // 09/11/2025 (sábado)
 * const adjusted = adjustToBusinessDay(closing);
 * // Retorna: 07/11/2025 (sexta-feira)
 * 
 * @example
 * // Caso 2: Fechamento cai no domingo
 * const closing = new Date(2025, 10, 10); // 10/11/2025 (domingo)
 * const adjusted = adjustToBusinessDay(closing);
 * // Retorna: 07/11/2025 (sexta-feira)
 * 
 * @example
 * // Caso 3: Fechamento já é dia útil
 * const closing = new Date(2025, 10, 7); // 07/11/2025 (sexta-feira)
 * const adjusted = adjustToBusinessDay(closing);
 * // Retorna: 07/11/2025 (mesma data)
 */
export function adjustToBusinessDay(date: Date): Date {
  if (isSaturday(date)) {
    // Sábado → volta 1 dia → sexta-feira
    return subDays(date, 1);
  }
  if (isSunday(date)) {
    // Domingo → volta 2 dias → sexta-feira
    return subDays(date, 2);
  }
  // Já é dia útil (segunda a sexta), retorna data original
  return date;
}

/**
 * Determina o mês de faturamento (billingMonth) para uma despesa de cartão de crédito,
 * baseado na data da transação, dia de fechamento e política de virada.
 * 
 * Algoritmo de cálculo:
 * 1. Extrai ano e mês da data da transação
 * 2. Cria data de fechamento para aquele mês usando o closingDay configurado
 * 3. Ajusta fechamento para dia útil se cair em fim de semana (via adjustToBusinessDay)
 * 4. Compara data da transação com fechamento ajustado:
 *    - Transação <= fechamento → fatura do MÊS ATUAL (mesmo mês da compra)
 *    - Transação > fechamento → fatura do MÊS SEGUINTE (compra após corte)
 * 5. Retorna string formatada 'YYYY-MM' representando o mês da fatura
 * 
 * @param txDate - Data da compra/despesa (Date object)
 * @param closingDay - Dia de fechamento do cartão (1-31, configurado por cartão)
 * @param policy - Política de virada ('NEXT' ou 'PREVIOUS', padrão: 'NEXT')
 * @returns String no formato 'YYYY-MM' indicando o mês da fatura
 * 
 * @example
 * // Cenário 1: Compra ANTES do fechamento (entra na fatura do mês corrente)
 * const txDate = new Date(2025, 10, 5); // 05/11/2025 (quinta-feira)
 * const billingMonth = deriveBillingMonth(txDate, 9, 'NEXT');
 * 
 * // Passo a passo:
 * // 1. Fechamento configurado: dia 09 de novembro
 * // 2. 09/11/2025 cai no sábado → ajusta para 07/11/2025 (sexta)
 * // 3. Compara: 05/11 <= 07/11 (compra ANTES do fechamento)
 * // 4. Resultado: "2025-11" (fatura de novembro/2025)
 * 
 * @example
 * // Cenário 2: Compra DEPOIS do fechamento (entra na fatura do próximo mês)
 * const txDate = new Date(2025, 10, 8); // 08/11/2025 (sábado)
 * const billingMonth = deriveBillingMonth(txDate, 9, 'NEXT');
 * 
 * // Passo a passo:
 * // 1. Fechamento configurado: dia 09 de novembro
 * // 2. 09/11/2025 (sábado) → ajusta para 07/11/2025 (sexta)
 * // 3. Compara: 08/11 > 07/11 (compra DEPOIS do fechamento)
 * // 4. Resultado: "2025-12" (fatura de dezembro/2025)
 * 
 * @example
 * // Cenário 3: Virada de ano (dezembro → janeiro)
 * const txDate = new Date(2025, 11, 15); // 15/12/2025
 * const billingMonth = deriveBillingMonth(txDate, 10, 'NEXT');
 * 
 * // Passo a passo:
 * // 1. Fechamento: 10/12/2025
 * // 2. Compara: 15/12 > 10/12 (após fechamento)
 * // 3. Avança para próximo mês → janeiro/2026
 * // 4. Resultado: "2026-01" (fatura de janeiro do ano seguinte)
 * 
 * @example
 * // Cenário 4: Política PREVIOUS (fecha mais cedo)
 * const txDate = new Date(2025, 10, 7); // 07/11/2025 (sexta)
 * const billingMonth = deriveBillingMonth(txDate, 9, 'PREVIOUS');
 * 
 * // Com PREVIOUS: despesas ATÉ o fechamento vão para o mês corrente
 * // 07 <= 07 → "2025-11"
 * // 
 * // Se fosse 08/11:
 * // 08 > 07 → "2025-12" (vai para próximo mês)
 */
export function deriveBillingMonth(
  txDate: Date,
  closingDay: number,
  policy: BillingRolloverPolicy = 'NEXT'
): string {
  // 1. Extrair ano e mês da transação
  const year = txDate.getFullYear();
  const month = txDate.getMonth(); // 0-indexed: janeiro = 0, dezembro = 11

  // 2. Criar data de fechamento para o mês da transação
  // Exemplo: txDate = 08/11/2025, closingDay = 9 → closingDate = 09/11/2025
  let closingDate = new Date(year, month, closingDay);

  // 3. Ajustar fechamento para dia útil se cair em fim de semana
  // Exemplo: 09/11/2025 (sábado) → 07/11/2025 (sexta)
  closingDate = adjustToBusinessDay(closingDate);

  // 4. Determinar mês de faturamento com base na política
  if (policy === 'NEXT') {
    // Política NEXT: Despesas APÓS o fechamento vão para o PRÓXIMO mês
    if (txDate > closingDate) {
      // Compra depois do corte → fatura do mês seguinte
      const nextMonth = new Date(year, month + 1, 1);
      return format(nextMonth, 'yyyy-MM');
    }
    // Compra antes ou no dia do corte → fatura do mês atual
    return format(new Date(year, month, 1), 'yyyy-MM');
  } else {
    // Política PREVIOUS: Despesas ATÉ o fechamento vão para o MÊS CORRENTE
    if (txDate <= closingDate) {
      // Compra até o corte (inclusive) → fatura do mês atual
      return format(new Date(year, month, 1), 'yyyy-MM');
    }
    // Compra após o corte → fatura do próximo mês
    const nextMonth = new Date(year, month + 1, 1);
    return format(nextMonth, 'yyyy-MM');
  }
}

/**
 * Valida se um dia de fechamento está dentro do intervalo permitido (1-31)
 * 
 * @param closingDay - Número inteiro representando o dia do mês
 * @returns true se válido (entre 1 e 31), false caso contrário
 * 
 * @example
 * isValidClosingDay(15);  // true - dia 15 é válido
 * isValidClosingDay(0);   // false - não existe dia 0
 * isValidClosingDay(32);  // false - meses têm no máximo 31 dias
 * isValidClosingDay(7.5); // false - não é inteiro
 */
export function isValidClosingDay(closingDay: number): boolean {
  return Number.isInteger(closingDay) && closingDay >= 1 && closingDay <= 31;
}

/**
 * Formata billingMonth para exibição user-friendly na UI
 * 
 * @param billingMonth - String no formato 'YYYY-MM' (ex: "2025-11")
 * @param locale - Código de locale para formatação (padrão: 'pt-BR')
 * @param formatType - Tipo de formatação: 'long' (completo) ou 'short' (abreviado)
 * @returns String formatada para exibição
 * 
 * @example
 * formatBillingMonth("2025-11");
 * // Retorna: "Novembro 2025"
 * 
 * @example
 * formatBillingMonth("2025-11", "pt-BR", "short");
 * // Retorna: "Nov/25"
 * 
 * @example
 * // Uso na UI:
 * <Typography variant="h5">
 *   Fatura de {formatBillingMonth(billingMonth)}
 * </Typography>
 */
export function formatBillingMonth(
  billingMonth: string,
  locale: string = 'pt-BR',
  formatType: 'long' | 'short' = 'long'
): string {
  const [year, month] = billingMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  if (formatType === 'short') {
    // Formato curto: "Nov/25"
    const monthName = date.toLocaleDateString(locale, { month: 'short' });
    const shortYear = year.toString().slice(-2);
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${shortYear}`;
  }

  // Formato longo: "Novembro 2025"
  const monthName = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

/**
 * Calcula a data de vencimento da fatura com base no fechamento
 * 
 * Geralmente, o vencimento é X dias após o fechamento (padrão: 10 dias).
 * Exemplo: Fatura fecha dia 09, vence dia 19 (9 + 10).
 * 
 * @param billingMonth - Mês da fatura no formato 'YYYY-MM'
 * @param closingDay - Dia de fechamento (1-31)
 * @param daysAfterClosing - Quantidade de dias entre fechamento e vencimento (padrão: 10)
 * @returns Date object representando o vencimento
 * 
 * @example
 * // Fatura de novembro/2025, fecha dia 9, vence 10 dias depois
 * const dueDate = calculateDueDate("2025-11", 9, 10);
 * // Retorna: Date(2025, 10, 19) → 19/11/2025
 * 
 * @example
 * // Uso na UI para exibir data de vencimento
 * const dueDate = calculateDueDate(billingMonth, origin.closingDay);
 * console.log(`Vencimento: ${format(dueDate, 'dd/MM/yyyy')}`);
 * // Output: "Vencimento: 19/11/2025"
 */
export function calculateDueDate(
  billingMonth: string,
  closingDay: number,
  daysAfterClosing: number = 10
): Date {
  const [year, month] = billingMonth.split('-').map(Number);
  
  // Criar data de fechamento
  const closingDate = new Date(year, month - 1, closingDay);
  
  // Adicionar dias para calcular vencimento
  const dueDate = addDays(closingDate, daysAfterClosing);
  
  return dueDate;
}

