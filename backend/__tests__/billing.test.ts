import { describe, it, expect } from 'vitest';
import { adjustToBusinessDay, getEffectiveClosingDate, deriveBillingMonth } from '../src/lib/billing';

describe('billing.ts - Cálculo de fatura de cartão de crédito', () => {
  describe('adjustToBusinessDay', () => {
    it('deve mover sábado para sexta com policy PREVIOUS', () => {
      // 02/11/2025 é segunda, então 01/11 é domingo e 31/10 é sábado
      // Vamos usar 08/11/2025 que é sábado no timezone local brasileiro
      const saturday = new Date(2025, 10, 8, 12, 0, 0); // Local time
      const result = adjustToBusinessDay(saturday, 'PREVIOUS');
      
      // Deve voltar para 07/11/2025 (sexta-feira)
      expect(result.getDate()).toBe(7);
      expect(result.getDay()).toBe(5); // 5 = sexta-feira
    });

    it('deve mover sábado para segunda com policy NEXT', () => {
      // 08/11/2025 é sábado no timezone local
      const saturday = new Date(2025, 10, 8, 12, 0, 0);
      const result = adjustToBusinessDay(saturday, 'NEXT');
      
      // Deve avançar para 10/11/2025 (segunda-feira)
      expect(result.getDate()).toBe(10);
      expect(result.getDay()).toBe(1); // 1 = segunda-feira
    });

    it('deve mover domingo para sexta com policy PREVIOUS', () => {
      // 09/11/2025 é domingo no timezone local
      const sunday = new Date(2025, 10, 9, 12, 0, 0);
      const result = adjustToBusinessDay(sunday, 'PREVIOUS');
      
      // Deve voltar para 07/11/2025 (sexta-feira) - volta 2 dias
      expect(result.getDate()).toBe(7);
      expect(result.getDay()).toBe(5); // 5 = sexta-feira
    });

    it('deve mover domingo para segunda com policy NEXT', () => {
      // 09/11/2025 é domingo no timezone local
      const sunday = new Date(2025, 10, 9, 12, 0, 0);
      const result = adjustToBusinessDay(sunday, 'NEXT');
      
      // Deve avançar para 10/11/2025 (segunda-feira)
      expect(result.getDate()).toBe(10);
      expect(result.getDay()).toBe(1); // 1 = segunda-feira
    });

    it('não deve alterar dia útil (segunda a sexta)', () => {
      // 07/11/2025 é sexta-feira no timezone local
      const friday = new Date(2025, 10, 7, 12, 0, 0);
      const result = adjustToBusinessDay(friday, 'PREVIOUS');
      
      // Deve manter a mesma data
      expect(result.getDate()).toBe(7);
      expect(result.getTime()).toBe(friday.getTime());
    });
  });

  describe('getEffectiveClosingDate', () => {
    it('deve retornar data de fechamento ajustada para fim de semana', () => {
      // Fechamento dia 09 (sábado) de novembro/2025
      const result = getEffectiveClosingDate(2025, 11, 9, 'PREVIOUS');
      
      // Deve ser 07/11/2025 23:59:59.999 UTC (sexta-feira)
      expect(result.getUTCDate()).toBe(7);
      expect(result.getUTCDay()).toBe(5); // sexta
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
    });

    it('deve retornar data de fechamento sem ajuste para dia útil', () => {
      // Fechamento dia 05 (quarta) de novembro/2025
      const result = getEffectiveClosingDate(2025, 11, 5, 'PREVIOUS');
      
      // Deve ser 05/11/2025 23:59:59.999 UTC (quarta-feira)
      expect(result.getUTCDate()).toBe(5);
      expect(result.getUTCDay()).toBe(3); // quarta
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
    });
  });

  describe('deriveBillingMonth', () => {
    it('deve manter mês atual quando compra é ANTES do fechamento', () => {
      // Compra em 05/11/2025 (quinta)
      // Fechamento dia 09 (sábado) → ajusta para 07/11 (sexta)
      // 05 < 07 → fatura de novembro
      const txDate = new Date(Date.UTC(2025, 10, 5, 10, 30, 0));
      const result = deriveBillingMonth(txDate, 9, 'PREVIOUS');
      
      expect(result).toBe('2025-11');
    });

    it('deve avançar para próximo mês quando compra é DEPOIS do fechamento', () => {
      // Compra em 08/11/2025 (sábado)
      // Fechamento dia 09 (sábado) → ajusta para 07/11 23:59 (sexta)
      // 08/11 00:00 > 07/11 23:59 → fatura de dezembro
      const txDate = new Date(Date.UTC(2025, 10, 8, 10, 30, 0));
      const result = deriveBillingMonth(txDate, 9, 'PREVIOUS');
      
      expect(result).toBe('2025-12');
    });

    it('deve rolar para janeiro quando dezembro ultrapassa fechamento', () => {
      // Compra em 15/12/2025
      // Fechamento dia 10
      // 15 > 10 → fatura de janeiro/2026
      const txDate = new Date(Date.UTC(2025, 11, 15, 10, 30, 0));
      const result = deriveBillingMonth(txDate, 10, 'PREVIOUS');
      
      expect(result).toBe('2026-01');
    });

    it('deve manter mês atual quando compra é exatamente no fechamento', () => {
      // Compra em 10/11/2025 23:59:59
      // Fechamento dia 10 às 23:59:59.999
      // Compra no mesmo timestamp → fatura de novembro
      const txDate = new Date(Date.UTC(2025, 10, 10, 23, 59, 59, 0));
      const result = deriveBillingMonth(txDate, 10, 'PREVIOUS');
      
      expect(result).toBe('2025-11');
    });

    it('deve funcionar com policy NEXT', () => {
      // Compra em 10/11/2025 (domingo)
      // Fechamento dia 09 (sábado) → ajusta para 11/11 23:59 (segunda) com NEXT
      // 10/11 00:00 < 11/11 23:59 → fatura de novembro
      const txDate = new Date(Date.UTC(2025, 10, 10, 10, 30, 0));
      const result = deriveBillingMonth(txDate, 9, 'NEXT');
      
      expect(result).toBe('2025-11');
    });

    it('deve formatar mês com zero à esquerda', () => {
      // Compra em janeiro
      const txDate = new Date(Date.UTC(2025, 0, 5, 10, 30, 0));
      const result = deriveBillingMonth(txDate, 10, 'PREVIOUS');
      
      expect(result).toBe('2025-01');
    });

    it('deve lidar com compra no último dia do mês antes do fechamento', () => {
      // Compra em 31/01/2025
      // Fechamento dia 31
      // 31 <= 31 → fatura de janeiro
      const txDate = new Date(Date.UTC(2025, 0, 31, 20, 0, 0));
      const result = deriveBillingMonth(txDate, 31, 'PREVIOUS');
      
      expect(result).toBe('2025-01');
    });

    it('deve lidar com compra no primeiro dia do mês antes do fechamento', () => {
      // Compra em 01/11/2025
      // Fechamento dia 09
      // 01 < 09 → fatura de novembro
      const txDate = new Date(Date.UTC(2025, 10, 1, 10, 30, 0));
      const result = deriveBillingMonth(txDate, 9, 'PREVIOUS');
      
      expect(result).toBe('2025-11');
    });
  });
});
