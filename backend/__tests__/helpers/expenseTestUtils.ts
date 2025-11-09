import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { vi } from 'vitest';

import app from '../../src/index';
import { getCsrfToken } from '../utils/csrf';

export const prisma = new PrismaClient() as any;

const baseExpense = {
  id: '507f1f77bcf86cd799439011',
  description: 'Despesa Teste CRUD',
  amount: 123.45,
  date: '2025-11-09T12:00:00.000Z',
  category: 'Alimentação',
  parcela: 'Único',
  userId: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

let currentExpense = { ...baseExpense };
let deleted = false;

const testUser = {
  email: 'danilo.uchoa@finance.app',
  password: 'finance123',
};

const ensureTransactionMock = () => {
  if (!prisma.$transaction) {
    prisma.$transaction = vi.fn(async (actions: any) => {
      if (Array.isArray(actions)) {
        return Promise.all(actions.map((fn) => (typeof fn === 'function' ? fn() : fn)));
      }
      if (typeof actions === 'function') {
        return actions();
      }
      return actions;
    });
  }
};

export const setupExpenseMocks = () => {
  ensureTransactionMock();

  prisma.expense.findUnique = vi.fn(async (args: any) => {
    if (deleted) return null;
    if (args?.where?.id === baseExpense.id) {
      return { ...currentExpense };
    }
    return null;
  });

  prisma.expense.create = vi.fn(async (args: any) => {
    deleted = false;
    currentExpense = { ...baseExpense, ...args?.data };
    return { ...currentExpense };
  });

  prisma.expense.update = vi.fn(async (args: any) => {
    if (deleted || args?.where?.id !== baseExpense.id) {
      throw new Error('Not found');
    }
    currentExpense = { ...currentExpense, ...args?.data };
    return { ...currentExpense };
  });

  prisma.expense.delete = vi.fn(async (args: any) => {
    if (deleted || args?.where?.id !== baseExpense.id) {
      throw new Error('Not found');
    }
    deleted = true;
    return { ...baseExpense };
  });

  prisma.expense.findMany = vi.fn(async (args: any = {}) => {
    if (deleted) return [];
    if (!args.where || args.where.id === baseExpense.id || !args.where.id) {
      return [{ ...currentExpense }];
    }
    return [];
  });

  prisma.expense.count = vi.fn(async () => (deleted ? 0 : 1));

  prisma.job = prisma.job ?? {};
  prisma.job.create = vi.fn().mockResolvedValue({ id: 'job-1', status: 'pending' });

  prisma.user = prisma.user ?? {};
  prisma.user.findUnique = vi.fn();
};

export const resetExpenseState = () => {
  deleted = false;
  currentExpense = { ...baseExpense };
};

export const markExpenseDeleted = () => {
  deleted = true;
};

export const getExpenseState = () => ({ ...currentExpense });
export const getExpenseId = () => baseExpense.id;
export const getBaseExpense = () => ({ ...baseExpense });

export const getTestUserCredentials = () => ({ ...testUser });

export const loginTestUser = async () => {
  resetExpenseState();
  setupExpenseMocks();

  const passwordHash = await bcrypt.hash(testUser.password, 10);
  prisma.user.findUnique.mockResolvedValue({
    id: 'user-123',
    email: testUser.email,
    name: 'Danilo Uchoa',
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

export const ensureExpenseExists = (overrides: Partial<typeof baseExpense> = {}) => {
  deleted = false;
  currentExpense = { ...baseExpense, ...overrides };
};

export const getPrismaMock = () => prisma;
