import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

const invalidPayloads = [
  { route: '/api/expenses', payload: { valor: 'not-a-number' } },
  { route: '/api/salaryHistory', payload: { amount: null } },
  { route: '/api/origins', payload: { name: '' } },
  { route: '/api/debtors', payload: { name: 123 } },
];

let accessToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'danilo.uchoa@finance.app', password: 'finance123' });
  accessToken = res.body.accessToken;
});

describe('Validação Zod - API', () => {
  invalidPayloads.forEach(({ route, payload }) => {
    it(`deve retornar 400 para payload inválido em ${route}`, async () => {
      const res = await request(app)
        .post(route)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload);
      expect([400, 422]).toContain(res.status);
      expect(res.body).toMatchObject({ message: expect.any(String) });
    });
  });
});
