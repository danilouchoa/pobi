import { describe, it, expect } from 'vitest';
import { adjustToBusinessDay, deriveBillingMonth } from '../src/utils/billingHelpers';
describe('adjustToBusinessDay', () => {
  it('retorna o mesmo dia se for dia útil', () => {
    const date = new Date(Date.UTC(2025, 10, 6)); // 6/11/2025 UTC (quinta)
    const adjusted = adjustToBusinessDay(date);
    expect(adjusted.getUTCDate()).toBe(6); // Mesmo dia do mês
    expect(adjusted.getUTCMonth()).toBe(10); // Mesmo mês
    expect(adjusted.getUTCFullYear()).toBe(2025); // Mesmo ano
  });
  it('ajusta sábado para sexta', () => {
    const date = new Date('2025-11-08'); // sábado
    const adjusted = adjustToBusinessDay(date);
    expect(adjusted.getDay()).toBe(5); // 5 = sexta
    expect(adjusted.getDate()).toBe(7); // 07/11/2025
  });
  it('ajusta domingo para sexta', () => {
    const date = new Date('2025-11-09'); // domingo
    const adjusted = adjustToBusinessDay(date);
    expect(adjusted.getDay()).toBe(5); // 5 = sexta
    expect(adjusted.getDate()).toBe(7); // 07/11/2025
  });
});
describe('deriveBillingMonth', () => {
  it('compra antes do fechamento (NEXT) vai para mês corrente', () => {
    const txDate = new Date('2025-11-05');
    const closingDay = 9;
    expect(deriveBillingMonth(txDate, closingDay, 'NEXT')).toBe('2025-11');
  });
  it('compra depois do fechamento (NEXT) vai para próximo mês', () => {
    const txDate = new Date('2025-11-10');
    const closingDay = 9;
    expect(deriveBillingMonth(txDate, closingDay, 'NEXT')).toBe('2025-12');
  });
  it('compra no fechamento ajustado (PREVIOUS) vai para mês corrente', () => {
    const txDate = new Date('2025-11-07'); // sexta, fechamento ajustado
    const closingDay = 9;
    expect(deriveBillingMonth(txDate, closingDay, 'PREVIOUS')).toBe('2025-11');
  });
  it('compra após fechamento ajustado (PREVIOUS) vai para próximo mês', () => {
    const txDate = new Date('2025-11-08'); // sábado
    const closingDay = 9;
    expect(deriveBillingMonth(txDate, closingDay, 'PREVIOUS')).toBe('2025-12');
  });
  it('virada de ano (NEXT)', () => {
    const txDate = new Date('2025-12-15');
    const closingDay = 10;
    expect(deriveBillingMonth(txDate, closingDay, 'NEXT')).toBe('2026-01');
  });
});
