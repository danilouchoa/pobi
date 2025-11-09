import './helpers/registerExpenseMocks';

import request from 'supertest';
import { describe, it, beforeAll, beforeEach, expect } from 'vitest';

import app from '../src/index';
import {
  setupExpenseMocks,
  resetExpenseState,
  ensureExpenseExists,
  loginTestUser,
  getBaseExpense,
} from './helpers/expenseTestUtils';
import { getCsrfToken } from './utils/csrf';

let accessToken: string;
const mockExpense = getBaseExpense();

describe('/expenses validações e erros', () => {
  beforeAll(async () => {
    setupExpenseMocks();
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
  });

  beforeEach(() => {
    resetExpenseState();
    ensureExpenseExists();
  });

  it('POST com recurring=true e fixed=true deve retornar 400', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        description: 'Despesa inválida',
        amount: '10.00',
        date: '2025-11-09T12:00:00.000Z',
        category: 'Teste',
        parcela: 'Único',
        recurring: true,
        fixed: true,
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /:id/adjust deve retornar 400 quando sharedAmount > amount', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .patch(`/api/expenses/${mockExpense.id}/adjust`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ sharedAmount: '9999.99' });

    expect(res.status).toBe(400);
  });

  it('PUT com ObjectId inválido deve retornar 400', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .put('/api/expenses/invalid-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ description: 'Teste' });

    expect(res.status).toBe(400);
  });

  it('DELETE com id inexistente deve retornar 404', async () => {
    const csrf = await getCsrfToken();
    const nonExistingId = '507f1f77bcf86cd799439012';

    const res = await request(app)
      .delete(`/api/expenses/${nonExistingId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
  });

  it('PUT deve aceitar atualização parcial da descrição', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .put(`/api/expenses/${mockExpense.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ description: 'Update Parcial' });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Update Parcial');
  });
});
