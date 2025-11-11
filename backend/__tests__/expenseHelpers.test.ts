import { describe, expect, it } from 'vitest';
import { buildCreateData } from '../src/utils/expenseHelpers';

describe('buildCreateData', () => {
  it('infers installments from parcela when not provided', () => {
    const data = buildCreateData('user-123', {
      description: 'Notebook (1/4)',
      category: 'Eletrônicos',
      amount: '800.00',
      parcela: '1/4',
      date: '2025-01-05',
    });

    expect(data.parcela).toBe('1/4');
    expect(data.installments).toBe(4);
  });

  it('keeps explicit installments when provided', () => {
    const data = buildCreateData('user-123', {
      description: 'Compra especial',
      category: 'Eletrônicos',
      amount: '800.00',
      parcela: '1/4',
      installments: 10,
      date: '2025-01-05',
    });

    expect(data.installments).toBe(10);
  });
});
