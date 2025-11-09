import './helpers/registerExpenseMocks';

import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '../src/index';

describe('/expenses autenticação', () => {
  it('GET /recurring sem token deve retornar 401', async () => {
    const res = await request(app).get('/api/expenses/recurring');

    expect(res.status).toBe(401);
  });
});
