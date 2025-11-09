import request from 'supertest';
import app from '../src';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrismaMock, loginTestUser, getAuthorizedHeaders, ensureExpenseExists } from './helpers/expenseTestUtils';

const prisma = getPrismaMock();

describe('Bulk delete endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete selected expenses and return standardized response', async () => {
    // Arrange: autentica e garante ao menos 1 despesa existente
    const auth = await loginTestUser();
    ensureExpenseExists();
    const { headers } = await getAuthorizedHeaders(auth.accessToken);

    const ids = ['507f1f77bcf86cd799439011'];

    const res = await request(app)
      .post('/api/expenses/bulk')
      .set(headers)
      .send({ action: 'delete', ids });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.deletedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.updatedCount).toBe(0);
  });

  it('should validate payload (empty ids)', async () => {
    const auth = await loginTestUser();
    const { headers } = await getAuthorizedHeaders(auth.accessToken);

    const res = await request(app)
      .post('/api/expenses/bulk')
      .set(headers)
      .send({ action: 'delete', ids: [] });

    expect(res.status).toBe(400);
  });
});
