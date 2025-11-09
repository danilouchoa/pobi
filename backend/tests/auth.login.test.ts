import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index';

// Mock de seed e reset de banco (exemplo, ajuste conforme sua infra)
beforeAll(async () => {
  // await seedTestDatabase();
});
afterAll(async () => {
  // await cleanupTestDatabase();
});

describe('POST /api/auth/login', () => {

  it('deve autenticar com credenciais válidas e retornar cookie httpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'danilo.uchoa@finance.app', password: 'finance123' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body).toHaveProperty('user');
  });

  it('deve rejeitar login com credenciais inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'danilo.uchoa@finance.app', password: 'senhaErrada' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
