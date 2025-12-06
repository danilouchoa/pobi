import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import app from '../src/index';
import { getPrismaMock, loginTestUser } from './helpers/expenseTestUtils';

const prisma = getPrismaMock();

describe('Middleware: requireEmailVerified', () => {
  let accessToken: string;

  beforeEach(async () => {
    const auth = await loginTestUser();
    accessToken = auth.accessToken;
  });

  it('permite acesso a rota sensível quando o usuário está com e-mail verificado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', emailVerifiedAt: new Date() });
    prisma.job.findFirst.mockResolvedValue({ id: 'job-42', userId: 'user-123', status: 'done' });

    const res = await request(app)
      .get('/api/jobs/job-42/status')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(prisma.job.findFirst).toHaveBeenCalledWith({ where: { id: 'job-42', userId: 'user-123' } });
  });

  it('bloqueia acesso para usuário com e-mail não verificado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', emailVerifiedAt: null });

    const res = await request(app)
      .get('/api/jobs/job-99/status')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.message).toMatch(/e-mail ainda não foi confirmado/i);
    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 403 no acesso à DLQ para usuário não verificado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', emailVerifiedAt: null });

    const res = await request(app)
      .get('/api/dlq/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });
});
