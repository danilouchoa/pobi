import request from 'supertest';
import app from '../src';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginTestUser, getAuthorizedHeaders, ensureExpenseExists } from './helpers/expenseTestUtils';

describe('Bulk unified endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('update items inline and return counts', async () => {
    const auth = await loginTestUser();
    const { headers } = await getAuthorizedHeaders(auth.accessToken);
    ensureExpenseExists();

    const res = await request(app)
      .post('/api/expenses/bulk')
      .set(headers)
      .send({ action: 'update', items: [{ id: '507f1f77bcf86cd799439011', category: 'Food' }] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.updatedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.deletedCount).toBe(0);
  });
});
