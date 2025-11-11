import './helpers/registerExpenseMocks';

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import app from '../src/index';
import { getCsrfToken } from './utils/csrf';
import {
  setupExpenseMocks,
  resetExpenseState,
  ensureExpenseExists,
  loginTestUser,
  getPrismaMock,
  getBaseExpense,
} from './helpers/expenseTestUtils';

const prisma = getPrismaMock();
const mockExpense = getBaseExpense();

const expensePayload = {
  description: 'Despesa Teste CRUD',
  amount: '123.45',
  date: '2025-11-09T12:00:00.000Z',
  category: 'Alimentação',
  parcela: 'Único',
};

let accessToken: string;
let createdExpenseId: string;

describe('/expenses CRUD', () => {
  beforeAll(async () => {
    setupExpenseMocks();
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
    createdExpenseId = mockExpense.id;
  });

  beforeEach(() => {
    resetExpenseState();
    ensureExpenseExists({ billingMonth: '2025-11' });
  });

  afterAll(async () => {
    if (createdExpenseId) {
      await prisma.expense.delete({ where: { id: createdExpenseId } }).catch(() => undefined);
    }
  });

  it('deve criar uma despesa', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(expensePayload);

    if (res.status !== 201) {
      throw new Error('Erro criação: ' + JSON.stringify(res.body));
    }

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.description).toBe(expensePayload.description);
    createdExpenseId = res.body.id;
  });

  it('deve criar despesas em lote', async () => {
    const csrf = await getCsrfToken();
    const payload = [
      { ...expensePayload, description: 'Despesa Lote 1', parcela: '1/2' },
      { ...expensePayload, description: 'Despesa Lote 2', parcela: '2/2' },
    ];

    const res = await request(app)
      .post('/api/expenses/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(payload);

    if (res.status !== 201) {
      throw new Error('Erro criação em lote: ' + JSON.stringify(res.body));
    }

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('deve buscar despesas filtrando por billingMonth', async () => {
    const res = await request(app)
      .get('/api/expenses?billingMonth=2025-11')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('deve atualizar uma despesa', async () => {
    const csrf = await getCsrfToken();
    const updatePayload = {
      description: 'Despesa Atualizada',
      amount: '200.00',
      date: expensePayload.date,
      category: expensePayload.category,
      parcela: expensePayload.parcela,
    };

    const res = await request(app)
      .put(`/api/expenses/${mockExpense.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Despesa Atualizada');
    expect(res.body.amount).toBe(200.0);
  });

  it('deve deletar uma despesa', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .delete(`/api/expenses/${mockExpense.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ id: mockExpense.id });

    expect(res.status).toBe(204);

    const check = await prisma.expense.findMany({ where: { id: mockExpense.id } });
    expect(Array.isArray(check) ? check.length === 0 : true).toBe(true);
  });

  it('deve retornar 400 para payload inválido', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
  });
});
