import './helpers/registerExpenseMocks';

import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import app from '../src/index';
import { getCsrfToken } from './utils/csrf';
import {
  setupExpenseMocks,
  resetExpenseState,
  loginTestUser,
  getPrismaMock,
} from './helpers/expenseTestUtils';

const prisma = getPrismaMock();

let accessToken: string;

describe('/expenses/bulk - Cascade Delete', () => {
  beforeAll(async () => {
    setupExpenseMocks();
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
  });

  beforeEach(() => {
    resetExpenseState();
  });

  it('deve deletar todas as parcelas ao selecionar uma única parcela do grupo', async () => {
    // Setup: Create installment group (3 parcelas)
    const installments = [
      {
        id: 'installment-1',
        userId: 'user-test-id',
        description: 'Notebook (1/3)',
        parcela: '1/3',
        amount: '100.00',
        date: new Date('2025-01-10'),
        category: 'Eletrônicos',
        originId: null,
        debtorId: null,
        installments: 3,
        recurring: false,
        fixed: false,
        billingMonth: '2025-01',
      },
      {
        id: 'installment-2',
        userId: 'user-test-id',
        description: 'Notebook (2/3)',
        parcela: '2/3',
        amount: '100.00',
        date: new Date('2025-02-10'),
        category: 'Eletrônicos',
        originId: null,
        debtorId: null,
        installments: 3,
        recurring: false,
        fixed: false,
        billingMonth: '2025-02',
      },
      {
        id: 'installment-3',
        userId: 'user-test-id',
        description: 'Notebook (3/3)',
        parcela: '3/3',
        amount: '100.00',
        date: new Date('2025-03-10'),
        category: 'Eletrônicos',
        originId: null,
        debtorId: null,
        installments: 3,
        recurring: false,
        fixed: false,
        billingMonth: '2025-03',
      },
    ];

    // Mock findMany to return installment candidates
    prisma.expense.findMany.mockImplementation((args: any) => {
      // First call: fetch selected expenses by IDs
      if (args?.where?.id?.in) {
        return Promise.resolve(
          installments.filter((inst) => args.where.id.in.includes(inst.id))
        );
      }
      // Subsequent calls: cascade logic fetching all related installments
      if (args?.where?.parcela?.endsWith === '/3') {
        return Promise.resolve(installments);
      }
      return Promise.resolve([]);
    });

    prisma.expense.deleteMany.mockResolvedValue({ count: 3 });

    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/expenses/bulk')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        action: 'delete',
        ids: ['installment-2'], // Deleting only the 2nd installment
      });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(3); // All 3 installments should be deleted
    expect(res.body.status).toBe('ok');
  });

  it('deve deletar múltiplos grupos de parcelas quando selecionados', async () => {
    // Two separate installment groups
    const group1 = [
      {
        id: 'g1-1',
        userId: 'user-test-id',
        description: 'Compra A (1/2)',
        parcela: '1/2',
        amount: '50.00',
        date: new Date('2025-01-15'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: 2,
        recurring: false,
        fixed: false,
        billingMonth: '2025-01',
      },
      {
        id: 'g1-2',
        userId: 'user-test-id',
        description: 'Compra A (2/2)',
        parcela: '2/2',
        amount: '50.00',
        date: new Date('2025-02-15'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: 2,
        recurring: false,
        fixed: false,
        billingMonth: '2025-02',
      },
    ];

    const group2 = [
      {
        id: 'g2-1',
        userId: 'user-test-id',
        description: 'Compra B (1/4)',
        parcela: '1/4',
        amount: '25.00',
        date: new Date('2025-01-20'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: 4,
        recurring: false,
        fixed: false,
        billingMonth: '2025-01',
      },
      {
        id: 'g2-2',
        userId: 'user-test-id',
        description: 'Compra B (2/4)',
        parcela: '2/4',
        amount: '25.00',
        date: new Date('2025-02-20'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: 4,
        recurring: false,
        fixed: false,
        billingMonth: '2025-02',
      },
      {
        id: 'g2-3',
        userId: 'user-test-id',
        description: 'Compra B (3/4)',
        parcela: '3/4',
        amount: '25.00',
        date: new Date('2025-03-20'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: 4,
        recurring: false,
        fixed: false,
        billingMonth: '2025-03',
      },
      {
        id: 'g2-4',
        userId: 'user-test-id',
        description: 'Compra B (4/4)',
        parcela: '4/4',
        amount: '25.00',
        date: new Date('2025-04-20'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: 4,
        recurring: false,
        fixed: false,
        billingMonth: '2025-04',
      },
    ];

    const allExpenses = [...group1, ...group2];

    prisma.expense.findMany.mockImplementation((args: any) => {
      if (args?.where?.id?.in) {
        return Promise.resolve(
          allExpenses.filter((exp) => args.where.id.in.includes(exp.id))
        );
      }
      if (args?.where?.parcela?.endsWith === '/2') {
        return Promise.resolve(group1);
      }
      if (args?.where?.parcela?.endsWith === '/4') {
        return Promise.resolve(group2);
      }
      return Promise.resolve([]);
    });

    prisma.expense.deleteMany.mockResolvedValue({ count: 6 });

    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/expenses/bulk')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        action: 'delete',
        ids: ['g1-1', 'g2-2'], // Select 1 from each group
      });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(6); // 2 + 4 = 6 total
    expect(res.body.status).toBe('ok');
  });

  it('deve deletar apenas despesas únicas sem cascade quando não são parcelas', async () => {
    const singleExpenses = [
      {
        id: 'single-1',
        userId: 'user-test-id',
        description: 'Compra única 1',
        parcela: 'Único',
        amount: '30.00',
        date: new Date('2025-01-10'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: null,
        recurring: false,
        fixed: false,
        billingMonth: '2025-01',
      },
      {
        id: 'single-2',
        userId: 'user-test-id',
        description: 'Compra única 2',
        parcela: 'Único',
        amount: '40.00',
        date: new Date('2025-02-10'),
        category: 'Outros',
        originId: null,
        debtorId: null,
        installments: null,
        recurring: false,
        fixed: false,
        billingMonth: '2025-02',
      },
    ];

    prisma.expense.findMany.mockResolvedValue(singleExpenses);
    prisma.expense.delete.mockResolvedValue(singleExpenses[0] as any);
    prisma.expense.deleteMany.mockResolvedValue({ count: 2 });

    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/expenses/bulk')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        action: 'delete',
        ids: ['single-1', 'single-2'],
      });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(2); // Only 2 unique expenses
    expect(res.body.status).toBe('ok');
  });
});
