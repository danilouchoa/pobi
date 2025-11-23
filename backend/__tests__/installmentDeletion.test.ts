import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deleteExpenseCascade } from '../src/services/installmentDeletionService';

type MockExpense = {
  id: string;
  description: string;
  parcela: string | null;
  amount: string;
  originId: string | null;
  debtorId: string | null;
  installments: number | null;
  date: Date;
  billingMonth: string | null;
};

const buildExpense = (overrides: Partial<MockExpense> = {}): MockExpense => ({
  id: overrides.id ?? 'exp-1',
  description: overrides.description ?? 'Notebook (1/3)',
  parcela: overrides.parcela ?? '1/3',
  amount: overrides.amount ?? '100.00',
  originId: overrides.originId ?? null,
  debtorId: overrides.debtorId ?? null,
  installments: overrides.installments ?? null,
  date: overrides.date ?? new Date('2025-01-10T00:00:00.000Z'),
  billingMonth: overrides.billingMonth ?? '2025-01',
});

describe('deleteExpenseCascade', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      expense: {
        delete: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it('should delete a single expense when not an installment', async () => {
    const expense = buildExpense({ parcela: 'Único', description: 'Compra única' });

    const result = await deleteExpenseCascade(prisma, 'user-123', expense);

    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: expense.id } });
    expect(prisma.expense.deleteMany).not.toHaveBeenCalled();
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([expense]);
  });

  it('should delete all installments in the same group', async () => {
    const expense = buildExpense();
    const installments = [
      buildExpense({ id: 'exp-1', description: 'Notebook (1/3)', parcela: '1/3', installments: 3 }),
      buildExpense({ id: 'exp-2', description: 'Notebook (2/3)', parcela: '2/3', installments: 3, date: new Date('2025-02-10T00:00:00.000Z'), billingMonth: '2025-02' }),
      buildExpense({ id: 'exp-3', description: 'Notebook (3/3)', parcela: '3/3', installments: 3, date: new Date('2025-03-10T00:00:00.000Z'), billingMonth: '2025-03' }),
    ];

    prisma.expense.findMany.mockResolvedValue(installments);
    prisma.expense.deleteMany.mockResolvedValue({ count: 3 });

    const result = await deleteExpenseCascade(prisma, 'user-123', expense);

    expect(prisma.expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-123',
        parcela: { endsWith: '/3' },
        amount: '100.00',
        installments: 3,
        originId: { equals: null },
        debtorId: { equals: null },
      },
      select: expect.any(Object),
    });
    expect(prisma.expense.delete).not.toHaveBeenCalled();
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['exp-1', 'exp-2', 'exp-3'] },
        userId: 'user-123',
      },
    });
    expect(result.deleted).toHaveLength(3);
    expect(result.deleted.map((item) => item.id)).toEqual(['exp-1', 'exp-2', 'exp-3']);
  });

  it('should handle base descriptions containing parentheses safely', async () => {
    const expense = buildExpense({ description: 'Assinatura (Promoção) (1/4)', parcela: '1/4' });
    const installments = [
      buildExpense({ id: 'exp-1', description: 'Assinatura (Promoção) (1/4)', parcela: '1/4', installments: 4 }),
      buildExpense({ id: 'exp-2', description: 'Assinatura (Promoção) (2/4)', parcela: '2/4', installments: 4 }),
      buildExpense({ id: 'exp-3', description: 'Assinatura (Promoção) (3/4)', parcela: '3/4', installments: 4 }),
      buildExpense({ id: 'exp-4', description: 'Assinatura (Promoção) (4/4)', parcela: '4/4', installments: 4 }),
    ];

    prisma.expense.findMany.mockResolvedValue(installments);
    prisma.expense.deleteMany.mockResolvedValue({ count: 4 });

    const result = await deleteExpenseCascade(prisma, 'user-123', expense);

    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['exp-1', 'exp-2', 'exp-3', 'exp-4'] },
        userId: 'user-123',
      },
    });
    expect(result.deleted).toHaveLength(4);
  });

  it('should fall back to single deletion if no related installments found', async () => {
    const expense = buildExpense();

    prisma.expense.findMany.mockResolvedValue([
      buildExpense({ id: 'exp-extra', description: 'Outra compra (1/3)', parcela: '1/3', installments: 3 }),
    ]);

    const result = await deleteExpenseCascade(prisma, 'user-123', expense);

    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: expense.id } });
    expect(prisma.expense.deleteMany).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([expense]);
  });
});
