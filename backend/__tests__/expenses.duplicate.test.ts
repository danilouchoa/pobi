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
import './helpers/registerExpenseMocks';

let accessToken: string;
const mockExpense = getBaseExpense();

describe('/expenses duplicação', () => {
  beforeAll(async () => {
    setupExpenseMocks();
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
  });

  beforeEach(() => {
    resetExpenseState();
    ensureExpenseExists();
  });

  it('POST /:id/duplicate deve criar um clone', async () => {
    const csrf = await getCsrfToken();
    const res = await request(app)
      .post(`/api/expenses/${mockExpense.id}/duplicate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ incrementMonth: true });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
