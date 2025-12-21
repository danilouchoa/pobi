import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { vi } from 'vitest';

import app from '../../src/index';
import { getCsrfToken } from '../utils/csrf';

export const prisma = new PrismaClient() as any;

type ExpenseState = {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  parcela: string | null;
  userId: string;
  billingMonth: string | null;
  fingerprint: string | null;
  originId: string | null;
  debtorId: string | null;
  recurring: boolean;
  recurrenceType: string | null;
  fixed: boolean;
  installments: number | null;
  sharedWith: string | null;
  sharedAmount: number | null;
  createdAt: Date;
  updatedAt: Date;
};
type ExpenseOverrides = Partial<ExpenseState>;

type OriginRecord = {
  id: string;
  type: string | null;
  closingDay: number | null;
  billingRolloverPolicy: string | null;
  [key: string]: unknown;
};

const baseExpenseSeed = Object.freeze({
  id: '507f1f77bcf86cd799439011',
  description: 'Despesa Teste CRUD',
  amount: 123.45,
  date: '2025-11-09T12:00:00.000Z',
  category: 'Alimentação',
  parcela: 'Único',
  userId: 'user-123',
});

const testUser = Object.freeze({
  email: 'danilo.uchoa@finance.app',
  password: 'finance123',
});

let currentExpense: ExpenseState = createExpenseState();
let deleted = false;
let originRecords: Record<string, OriginRecord> = {};

function createExpenseState(overrides: ExpenseOverrides = {}): ExpenseState {
  const now = new Date();
  return {
    id: overrides.id ?? baseExpenseSeed.id,
    description: overrides.description ?? baseExpenseSeed.description,
    amount: overrides.amount ?? baseExpenseSeed.amount,
    date: overrides.date ?? baseExpenseSeed.date,
    category: overrides.category ?? baseExpenseSeed.category,
    parcela: overrides.parcela ?? baseExpenseSeed.parcela,
    userId: overrides.userId ?? baseExpenseSeed.userId,
    billingMonth: overrides.billingMonth ?? null,
    fingerprint: overrides.fingerprint ?? null,
    originId: overrides.originId ?? null,
    debtorId: overrides.debtorId ?? null,
    recurring: overrides.recurring ?? false,
    recurrenceType: overrides.recurrenceType ?? null,
    fixed: overrides.fixed ?? false,
    installments: overrides.installments ?? null,
    sharedWith: overrides.sharedWith ?? null,
    sharedAmount: overrides.sharedAmount ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const matchesWhere = (where: any): boolean => {
  if (!where || Object.keys(where).length === 0) {
    return true;
  }

  if (Array.isArray(where.OR) && where.OR.length) {
    return where.OR.some((clause: any) => matchesWhere(clause));
  }

  if (Array.isArray(where.AND) && where.AND.length) {
    return where.AND.every((clause: any) => matchesWhere(clause));
  }

  if (where.id) {
    if (typeof where.id === 'string' && where.id !== currentExpense.id) {
      return false;
    }
    if (where.id?.equals && where.id.equals !== currentExpense.id) {
      return false;
    }
    if (Array.isArray(where.id?.in) && !where.id.in.includes(currentExpense.id)) {
      return false;
    }
    if (Array.isArray(where.id?.notIn) && where.id.notIn.includes(currentExpense.id)) {
      return false;
    }
  }

  if (where.userId) {
    const filter =
      typeof where.userId === 'string' ? where.userId : where.userId?.equals ?? undefined;
    if (filter && filter !== currentExpense.userId) {
      return false;
    }
  }

  if (where.billingMonth) {
    const billingFilter =
      typeof where.billingMonth === 'string'
        ? where.billingMonth
        : where.billingMonth?.equals ?? where.billingMonth?.in?.[0] ?? undefined;
    if (billingFilter && billingFilter !== currentExpense.billingMonth) {
      return false;
    }
  }

  if (where.recurring !== undefined && currentExpense.recurring !== where.recurring) {
    return false;
  }

  if (where.fixed !== undefined && currentExpense.fixed !== where.fixed) {
    return false;
  }

  if (where.sharedWith) {
    if (where.sharedWith.not === null && currentExpense.sharedWith == null) {
      return false;
    }
    if (
      where.sharedWith.equals !== undefined &&
      currentExpense.sharedWith !== where.sharedWith.equals
    ) {
      return false;
    }
  }

  return true;
};

const applySelect = (record: any, select: Record<string, any> | undefined) => {
  if (!select) return record;
  const subset: Record<string, any> = {};
  for (const [key, value] of Object.entries(select)) {
    if (value) {
      subset[key] = record[key];
    }
  }
  return subset;
};

const ensureTransactionMock = () => {
  prisma.$transaction = vi.fn(async (actions: any) => {
    if (Array.isArray(actions)) {
      return Promise.all(
        actions.map((action) => (typeof action === 'function' ? action(prisma) : action))
      );
    }
    if (typeof actions === 'function') {
      return actions(prisma);
    }
    return actions;
  });
};

const ensureExpenseModel = () => {
  prisma.expense = prisma.expense ?? {};

  prisma.expense.findUnique = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) return null;
    return clone(currentExpense);
  });

  prisma.expense.findFirst = vi.fn(async (args: any = {}) => {
    const items = await prisma.expense.findMany(args);
    return items[0] ?? null;
  });

  prisma.expense.findMany = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) return [];
    const record = clone(currentExpense);
    if (args.select) {
      return [applySelect(record, args.select)];
    }
    return [record];
  });

  prisma.expense.count = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) return 0;
    return 1;
  });

  prisma.expense.aggregate = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) {
      return { _sum: { amount: 0 } };
    }
    const amount = Number(currentExpense.amount ?? 0);
    return { _sum: { amount } };
  });

  prisma.expense.create = vi.fn(async (args: any = {}) => {
    deleted = false;
    currentExpense = createExpenseState({
      ...args?.data,
      id: args?.data?.id ?? currentExpense.id ?? baseExpenseSeed.id,
      userId: args?.data?.userId ?? currentExpense.userId ?? baseExpenseSeed.userId,
    });
    return clone(currentExpense);
  });

  prisma.expense.createMany = vi.fn(async (args: any = {}) => {
    const data = Array.isArray(args?.data) ? args.data : [];
    if (data.length) {
      currentExpense = createExpenseState({ ...data[data.length - 1] });
      deleted = false;
    }
    return { count: data.length };
  });

  prisma.expense.update = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) {
      throw new Error('Not found');
    }
    currentExpense = createExpenseState({ ...currentExpense, ...args?.data });
    return clone(currentExpense);
  });

  prisma.expense.updateMany = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) {
      return { count: 0 };
    }
    currentExpense = createExpenseState({ ...currentExpense, ...args?.data });
    return { count: 1 };
  });

  prisma.expense.delete = vi.fn(async (args: any = {}) => {
    if (deleted || !matchesWhere(args.where)) {
      throw new Error('Not found');
    }
    deleted = true;
    return clone(currentExpense);
  });

  prisma.expense.deleteMany = vi.fn(async (args: any = {}) => {
    const match = !deleted && matchesWhere(args.where);
    if (match) {
      deleted = true;
      return { count: 1 };
    }
    return { count: 0 };
  });
};

const ensureUserModel = () => {
  prisma.user = prisma.user ?? {};
  prisma.user.findUnique = vi.fn();
};

const ensureOriginModel = () => {
  prisma.origin = prisma.origin ?? {};
  prisma.origin.findUnique = vi.fn(async (args: any = {}) => {
    const id = args?.where?.id;
    if (!id) return null;
    return originRecords[id] ? clone(originRecords[id]) : null;
  });
};

const ensureJobModel = () => {
  prisma.job = prisma.job ?? {};
  prisma.job.create = vi.fn().mockResolvedValue({ id: 'job-1', status: 'pending' });
};

export const resetOriginMocks = () => {
  originRecords = {};
};

export const mockOriginRecord = (origin: Partial<OriginRecord> & { id?: string }) => {
  if (!origin) return;
  const id = origin.id ?? 'origin-test';
  originRecords[id] = {
    id,
    type: origin.type ?? null,
    closingDay: origin.closingDay ?? null,
    billingRolloverPolicy: origin.billingRolloverPolicy ?? null,
    ...origin,
  } as OriginRecord;
};

export const setupExpenseMocks = () => {
  resetOriginMocks();
  resetExpenseState();
  ensureTransactionMock();
  ensureExpenseModel();
  ensureUserModel();
  ensureOriginModel();
  ensureJobModel();
};

export const resetExpenseState = () => {
  currentExpense = createExpenseState();
  deleted = false;
};

export const ensureExpenseExists = (overrides: ExpenseOverrides = {}) => {
  deleted = false;
  currentExpense = createExpenseState(overrides);
};

export const markExpenseDeleted = () => {
  deleted = true;
};

export const getExpenseState = () => clone(currentExpense);

export const getExpenseId = () => currentExpense.id;

export const getBaseExpense = () => {
  const { createdAt, updatedAt, ...rest } = createExpenseState();
  return rest;
};

export const getTestUserCredentials = () => ({ ...testUser });

export const getPrismaMock = () => prisma;

export const loginTestUser = async () => {
  setupExpenseMocks();

  const passwordHash = await bcrypt.hash(testUser.password, 10);
  prisma.user.findUnique.mockResolvedValue({
    id: 'user-123',
    email: testUser.email,
    name: 'Danilo Uchoa',
    emailVerifiedAt: new Date(),
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const csrf = await getCsrfToken();
  const res = await request(app)
    .post('/api/auth/login')
    .set('Cookie', csrf.csrfCookie)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(testUser);

  if (res.status !== 200) {
    throw new Error(`Falha no login de teste: ${res.status}`);
  }

  return {
    accessToken: res.body.accessToken,
    csrfToken: csrf.csrfToken,
    csrfCookie: csrf.csrfCookie,
  };
};

export const getAuthorizedHeaders = async (accessToken: string) => {
  const csrf = await getCsrfToken();
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: csrf.csrfCookie,
      'X-CSRF-Token': csrf.csrfToken,
    },
    csrf,
  };
};
