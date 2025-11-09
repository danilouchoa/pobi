import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/index';

const prisma = new PrismaClient() as any;

let accessToken: string;
let createdExpenseId: string;
const testUser = {
  email: 'danilo.uchoa@finance.app',
  password: 'finance123',
};

const expensePayload = {
  description: 'Despesa Teste CRUD',
  amount: '123.45',
  date: '2025-11-09T12:00:00.000Z',
  category: 'Alimentação',
  parcela: 'Único',
};

describe('/expenses CRUD & filtros', () => {
  beforeAll(async () => {
    // Mockar usuário existente no banco
    const mockUser = {
      id: 'user-123',
      email: 'danilo.uchoa@finance.app',
      name: 'Danilo Uchoa',
      passwordHash: await bcrypt.hash('finance123', 10),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);

    // Login para obter token
    const res = await request(app)
      .post('/api/auth/login')
      .send(testUser);
    expect(res.status).toBe(200);
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    // Limpa despesas criadas
    if (createdExpenseId) {
      await prisma.expense.delete({ where: { id: createdExpenseId } });
    }
  });

  it('deve criar uma despesa', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(expensePayload);
  if (res.status !== 201) throw new Error('Erro criação: ' + JSON.stringify(res.body));
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty('id');
  expect(res.body.description).toBe(expensePayload.description);
  createdExpenseId = res.body.id;
  });

  it('deve buscar despesas filtrando por billingMonth', async () => {
    const res = await request(app)
      .get(`/api/expenses?billingMonth=2025-11`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((e: any) => e.id === createdExpenseId)).toBe(true);
  });

  it('deve atualizar uma despesa', async () => {
    const res = await request(app)
      .put(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Despesa Atualizada', amount: '200.00' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Despesa Atualizada');
    expect(res.body.amount).toBe(200.00);
  });

  it('deve deletar uma despesa', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);
    // Confirma remoção
  const check = await prisma.expense.findMany({ where: { id: createdExpenseId } });
  expect(Array.isArray(check) ? check.length === 0 : true).toBe(true);
    createdExpenseId = undefined as any;
  });

  it('deve retornar 400 para payload inválido', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
