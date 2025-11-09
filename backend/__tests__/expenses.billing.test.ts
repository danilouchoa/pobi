import './helpers/registerExpenseMocks';

import request from 'supertest';
import { describe, it, beforeAll, beforeEach, expect } from 'vitest';

import app from '../src/index';
import {
  setupExpenseMocks,
  resetExpenseState,
  ensureExpenseExists,
  loginTestUser,
} from './helpers/expenseTestUtils';

let accessToken: string;

describe('/expenses modo billing', () => {
  beforeAll(async () => {
    setupExpenseMocks();
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
  });

  beforeEach(() => {
    resetExpenseState();
    ensureExpenseExists();
  });

  it('GET modo billing sem month deve retornar 400', async () => {
    const res = await request(app)
      .get('/api/expenses?mode=billing')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('GET modo billing com month válido deve retornar 200', async () => {
    const res = await request(app)
      .get('/api/expenses?mode=billing&month=2025-11')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
