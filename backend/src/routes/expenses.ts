import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  userId?: string;
  body: {
    description?: string;
    category?: string;
    parcela?: string;
    amount?: number;
    date?: string;
    originId?: string;
    debtorId?: string | null;
    incrementMonth?: boolean;
    customDate?: string;
  };
}

const serializeExpense = (expense: {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: string;
  originId: string;
  debtorId: string | null;
}) => ({
  id: expense.id,
  description: expense.description,
  amount: expense.amount,
  date: expense.date.toISOString(),
  category: expense.category,
  originId: expense.originId,
  debtorId: expense.debtorId,
});

export default function expensesRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const expenses = await prisma.expense.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });

      res.json(expenses.map(serializeExpense));
    } catch (error) {
      console.error('Erro ao listar despesas:', error);
      res.status(500).json({ message: 'Erro interno ao listar despesas.' });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { description, category, parcela, amount, date, originId, debtorId } = req.body;

      const numericAmount = Number(amount);

      if (
        !description ||
        !category ||
        !parcela ||
        amount == null ||
        Number.isNaN(numericAmount) ||
        !date ||
        !originId
      ) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
      }

      const expense = await prisma.expense.create({
        data: {
          description,
          category,
          parcela,
          amount: numericAmount,
          date: new Date(date),
          originId,
          debtorId,
          userId,
        },
      });

      res.status(201).json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      res.status(500).json({ message: 'Erro interno ao criar despesa.' });
    }
  });

  router.put('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { id } = req.params;
      const { description, category, parcela, amount, date, originId, debtorId } = req.body;
      const numericAmount = typeof amount === 'number' ? amount : Number(amount);

      const existing = await prisma.expense.findUnique({ where: { id } });

      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      const expense = await prisma.expense.update({
        where: { id },
        data: {
          description,
          category,
          parcela,
          amount: amount == null || Number.isNaN(numericAmount) ? undefined : numericAmount,
          date: date ? new Date(date) : undefined,
          originId,
          debtorId,
        },
      });

      res.json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao atualizar despesa:', error);
      res.status(500).json({ message: 'Erro interno ao atualizar despesa.' });
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { id } = req.params;

      const existing = await prisma.expense.findUnique({ where: { id } });

      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      await prisma.expense.delete({ where: { id } });

      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      res.status(500).json({ message: 'Erro interno ao excluir despesa.' });
    }
  });

  router.post('/:id/duplicate', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { id } = req.params;
      const { incrementMonth = false, customDate } = req.body;

      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      let cloneDate = customDate ? new Date(customDate) : new Date(existing.date);
      if (!customDate && incrementMonth) {
        cloneDate = new Date(cloneDate);
        cloneDate.setMonth(cloneDate.getMonth() + 1);
      }

      const duplicated = await prisma.expense.create({
        data: {
          description: existing.description,
          category: existing.category,
          parcela: existing.parcela,
          amount: existing.amount,
          date: cloneDate,
          originId: existing.originId,
          debtorId: existing.debtorId,
          userId,
        },
      });

      res.status(201).json(serializeExpense(duplicated));
    } catch (error) {
      console.error('Erro ao duplicar despesa:', error);
      res.status(500).json({ message: 'Erro interno ao duplicar despesa.' });
    }
  });

  router.patch('/:id/adjust', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { id } = req.params;
      const existing = await prisma.expense.findUnique({ where: { id } });

      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      const { description, category, parcela, amount, date, originId, debtorId } = req.body;
      const numericAmount = amount == null ? undefined : Number(amount);

      const data: Record<string, unknown> = {};
      if (description !== undefined) data.description = description;
      if (category !== undefined) data.category = category;
      if (parcela !== undefined) data.parcela = parcela;
      if (originId !== undefined) data.originId = originId;
      if (debtorId !== undefined) data.debtorId = debtorId;
      if (date) data.date = new Date(date);
      if (numericAmount !== undefined && !Number.isNaN(numericAmount)) {
        data.amount = numericAmount;
      }

      const updated = await prisma.expense.update({
        where: { id },
        data,
      });

      res.json(serializeExpense(updated));
    } catch (error) {
      console.error('Erro ao ajustar despesa:', error);
      res.status(500).json({ message: 'Erro interno ao ajustar despesa.' });
    }
  });

  return router;
}
