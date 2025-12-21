import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach } from 'vitest';

import app from '../../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId, tokenType: 'access' }, process.env.JWT_SECRET ?? 'test-secret-key');

const userA = { id: 'user-a', emailVerifiedAt: new Date() };
const userB = { id: 'user-b', emailVerifiedAt: new Date() };

const setupPrismaMocks = () => {
  let origins = [
    {
      id: 'origin-a',
      userId: userA.id,
      name: 'Origin A',
      type: 'Conta',
      dueDay: null,
      limit: null,
      status: null,
      active: true,
    },
  ];
  let debtors = [
    {
      id: 'debtor-a',
      userId: userA.id,
      name: 'Debtor A',
      status: null,
      active: true,
    },
  ];
  let expenses = [
    {
      id: 'expense-a',
      userId: userA.id,
      description: 'Expense A',
      amount: '10.00',
      date: new Date('2025-11-10T00:00:00.000Z'),
      category: 'Outros',
      parcela: 'Único',
      recurring: false,
      recurrenceType: null,
      fixed: false,
      installments: null,
      sharedWith: null,
      sharedAmount: null,
      originId: 'origin-a',
      debtorId: 'debtor-a',
      billingMonth: '2025-11',
      installmentGroupId: null,
      fingerprint: 'fp-a',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  let salaryHistory = [
    {
      id: 'salary-a',
      userId: userA.id,
      month: '2025-11',
      hours: 10,
      hourRate: 100,
      taxRate: 0.1,
      cnae: null,
    },
  ];
  let jobs = [
    {
      id: 'job-a',
      userId: userA.id,
      status: 'pending',
    },
  ];

  prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
    if (where?.id === userA.id) return userA;
    if (where?.id === userB.id) return userB;
    return null;
  });

  prisma.origin.findMany.mockImplementation(async ({ where }: any) => {
    if (!where?.userId) return origins;
    return origins.filter((origin) => origin.userId === where.userId);
  });
  prisma.origin.findFirst.mockImplementation(async ({ where }: any) => {
    return origins.find(
      (origin) => origin.id === where?.id && origin.userId === where?.userId
    );
  });
  prisma.origin.updateMany.mockImplementation(async ({ where, data }: any) => {
    const match = origins.find((origin) => origin.id === where.id && origin.userId === where.userId);
    if (!match) return { count: 0 };
    Object.assign(match, data);
    return { count: 1 };
  });
  prisma.origin.deleteMany.mockImplementation(async ({ where }: any) => {
    const before = origins.length;
    origins = origins.filter((origin) => !(origin.id === where.id && origin.userId === where.userId));
    return { count: before - origins.length };
  });

  prisma.debtor.findMany.mockImplementation(async ({ where }: any) => {
    if (!where?.userId) return debtors;
    return debtors.filter((debtor) => debtor.userId === where.userId);
  });
  prisma.debtor.findFirst.mockImplementation(async ({ where }: any) => {
    return debtors.find((debtor) => debtor.id === where?.id && debtor.userId === where?.userId);
  });
  prisma.debtor.updateMany.mockImplementation(async ({ where, data }: any) => {
    const match = debtors.find((debtor) => debtor.id === where.id && debtor.userId === where.userId);
    if (!match) return { count: 0 };
    Object.assign(match, data);
    return { count: 1 };
  });
  prisma.debtor.deleteMany.mockImplementation(async ({ where }: any) => {
    const before = debtors.length;
    debtors = debtors.filter((debtor) => !(debtor.id === where.id && debtor.userId === where.userId));
    return { count: before - debtors.length };
  });

  prisma.expense.findMany.mockImplementation(async ({ where }: any) => {
    if (!where?.userId) return expenses;
    return expenses.filter((expense) => expense.userId === where.userId);
  });
  prisma.expense.count.mockImplementation(async ({ where }: any) => {
    return (await prisma.expense.findMany({ where })).length;
  });
  prisma.expense.findFirst.mockImplementation(async ({ where }: any) => {
    return expenses.find(
      (expense) => expense.id === where?.id && expense.userId === where?.userId
    );
  });
  prisma.expense.create.mockImplementation(async ({ data }: any) => {
    const created = {
      ...data,
      id: `expense-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expenses.push(created);
    return created;
  });
  prisma.expense.updateMany.mockImplementation(async ({ where, data }: any) => {
    const match = expenses.find((expense) => expense.id === where.id && expense.userId === where.userId);
    if (!match) return { count: 0 };
    Object.assign(match, data);
    return { count: 1 };
  });
  prisma.expense.deleteMany.mockImplementation(async ({ where }: any) => {
    const before = expenses.length;
    expenses = expenses.filter((expense) => !(expense.id === where.id && expense.userId === where.userId));
    return { count: before - expenses.length };
  });
  prisma.expense.delete.mockImplementation(async ({ where }: any) => {
    const match = expenses.find((expense) => expense.id === where.id);
    if (!match) {
      throw new Error('Not found');
    }
    expenses = expenses.filter((expense) => expense.id !== where.id);
    return match;
  });

  prisma.salaryHistory.findMany.mockImplementation(async ({ where }: any) => {
    if (!where?.userId) return salaryHistory;
    return salaryHistory.filter((record) => record.userId === where.userId);
  });
  prisma.salaryHistory.findFirst.mockImplementation(async ({ where }: any) => {
    return salaryHistory.find(
      (record) => record.id === where?.id && record.userId === where?.userId
    );
  });
  prisma.salaryHistory.updateMany.mockImplementation(async ({ where, data }: any) => {
    const match = salaryHistory.find((record) => record.id === where.id && record.userId === where.userId);
    if (!match) return { count: 0 };
    Object.assign(match, data);
    return { count: 1 };
  });
  prisma.salaryHistory.deleteMany.mockImplementation(async ({ where }: any) => {
    const before = salaryHistory.length;
    salaryHistory = salaryHistory.filter(
      (record) => !(record.id === where.id && record.userId === where.userId)
    );
    return { count: before - salaryHistory.length };
  });

  prisma.job.findFirst.mockImplementation(async ({ where }: any) => {
    return jobs.find((job) => job.id === where?.id && job.userId === where?.userId);
  });
};

describe('tenant isolation', () => {
  beforeEach(() => {
    setupPrismaMocks();
  });

  it('blocks unauthenticated access', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(401);
  });

  it('prevents cross-tenant access with 404 and scopes lists', async () => {
    const tokenB = signAccessToken(userB.id);

    const origins = await request(app)
      .get('/api/origins')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(origins.status).toBe(200);
    expect(origins.body).toEqual([]);

    const debtors = await request(app)
      .get('/api/debtors')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(debtors.status).toBe(200);
    expect(debtors.body).toEqual([]);

    const expenses = await request(app)
      .get('/api/expenses?month=2025-11')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(expenses.status).toBe(200);
    expect(expenses.body.data).toEqual([]);

    const salary = await request(app)
      .get('/api/salaryHistory')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(salary.status).toBe(200);
    expect(salary.body).toEqual([]);

    const job = await request(app)
      .get('/api/jobs/job-a/status')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(job.status).toBe(404);

    const updateOrigin = await request(app)
      .put('/api/origins/origin-a')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Injected', type: 'Conta' });
    expect(updateOrigin.status).toBe(404);

    const deleteDebtor = await request(app)
      .delete('/api/debtors/debtor-a')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteDebtor.status).toBe(404);

    const deleteExpense = await request(app)
      .delete('/api/expenses/expense-a')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteExpense.status).toBe(404);
  });

  it('ignores client userId on create', async () => {
    const tokenB = signAccessToken(userB.id);

    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        description: 'Injected Expense',
        amount: '20.00',
        date: '2025-11-01T00:00:00.000Z',
        category: 'Outros',
        parcela: 'Único',
        userId: userA.id,
      });

    expect(res.status).toBe(201);
    const createCall = prisma.expense.create.mock.calls[0]?.[0];
    expect(createCall?.data?.userId).toBe(userB.id);
  });
});
