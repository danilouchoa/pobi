import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { addMonths, format, startOfMonth } from 'date-fns';
import {
  addByRecurrence,
  buildCreateData,
  buildUpdateData,
  ensureOwnership,
  validateFlags,
  RecurrenceType,
  ExpensePayload,
  generateFingerprint,
} from '../utils/expenseHelpers';
import { parseDecimal, toDecimalString } from '../utils/formatters';
import { publishRecurringJob } from '../lib/rabbit';
import { getOrSetCache } from '../lib/redisCache';
import { redis } from '../lib/redisClient';

interface AuthenticatedRequest extends Request {
  userId?: string;
  body: ExpensePayload;
}

const serializeExpense = (expense: any) => ({
  id: expense.id,
  description: expense.description ?? '',
  amount: parseDecimal(expense.amount),
  date: expense.date ? new Date(expense.date).toISOString() : null,
  category: expense.category ?? '',
  originId: expense.originId ?? null,
  debtorId: expense.debtorId ?? null,
  fingerprint: expense.fingerprint ?? '',
  recurring: expense.recurring ?? false,
  recurrenceType: expense.recurrenceType ?? null,
  fixed: expense.fixed ?? false,
  installments: expense.installments ?? null,
  sharedWith: expense.sharedWith ?? null,
  sharedAmount: expense.sharedAmount != null ? parseDecimal(expense.sharedAmount) : null,
  createdAt: expense.createdAt ? new Date(expense.createdAt).toISOString() : null,
  updatedAt: expense.updatedAt ? new Date(expense.updatedAt).toISOString() : null,
});

const buildExpenseCacheKey = (userId: string, monthKey: string) =>
  `finance:expenses:${userId}:${monthKey}`;

const monthKeyFromInput = (input?: string | Date | null) => {
  if (!input) return null;
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'yyyy-MM');
};

const invalidateExpenseCache = async (userId: string, ...months: Array<string | null | undefined>) => {
  const keys = months
    .filter((monthKey): monthKey is string => Boolean(monthKey))
    .map((monthKey) => buildExpenseCacheKey(userId, monthKey));
  if (keys.length) {
    await redis.del(...keys);
  }
};


export default function expensesRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { month: monthQuery, year: yearQuery } = req.query as {
        month?: string;
        year?: string;
      };

      const now = new Date();
      let targetYear = now.getFullYear();
      let targetMonth = now.getMonth(); // zero-based

      if (typeof monthQuery === 'string' && /^\d{4}-\d{2}$/.test(monthQuery)) {
        const [yearStr, monthStr] = monthQuery.split('-');
        const parsedYear = Number(yearStr);
        const parsedMonth = Number(monthStr);
        if (!Number.isNaN(parsedYear) && !Number.isNaN(parsedMonth)) {
          targetYear = parsedYear;
          targetMonth = Math.max(0, Math.min(11, parsedMonth - 1));
        }
      } else if (typeof monthQuery === 'string') {
        const parsedMonth = Number(monthQuery);
        if (!Number.isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
          targetMonth = parsedMonth - 1;
        }
      }

      if (typeof yearQuery === 'string') {
        const parsedYear = Number(yearQuery);
        if (!Number.isNaN(parsedYear)) {
          targetYear = parsedYear;
        }
      }

      const start = startOfMonth(new Date(targetYear, targetMonth, 1));
      const end = startOfMonth(addMonths(start, 1));

      const monthKey = format(start, 'yyyy-MM');
      const cacheKey = buildExpenseCacheKey(userId, monthKey);
      const expenses = await getOrSetCache(cacheKey, async () => {
        const result = await prisma.expense.findMany({
          where: {
            userId,
            date: {
              gte: start,
              lt: end,
            },
          },
          orderBy: { date: 'desc' },
        });
        return result.map(serializeExpense);
      });

      res.json(expenses);
    } catch (error) {
      console.error('Erro ao listar despesas:', error);
      res.status(500).json({ message: 'Erro interno ao listar despesas.' });
    }
  });

  router.get('/recurring', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const expenses = await prisma.expense.findMany({
        where: {
          userId,
          OR: [{ recurring: true }, { fixed: true }],
        },
        orderBy: { date: 'desc' },
      });

      res.json(expenses.map(serializeExpense));
    } catch (error) {
      console.error('Erro ao listar despesas recorrentes:', error);
      res.status(500).json({ message: 'Erro interno ao listar despesas recorrentes.' });
    }
  });

  router.get('/shared', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const expenses = await prisma.expense.findMany({
        where: { userId, sharedWith: { not: null } },
        orderBy: { date: 'desc' },
      });

      res.json(expenses.map(serializeExpense));
    } catch (error) {
      console.error('Erro ao listar despesas compartilhadas:', error);
      res.status(500).json({ message: 'Erro interno ao listar despesas compartilhadas.' });
    }
  });

  router.post('/recurring', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const payload = buildCreateData(userId, {
        ...req.body,
        recurring: req.body.recurring ?? true,
        fixed: req.body.fixed ?? false,
      });

      const expense = await prisma.expense.create({ data: payload });
      await invalidateExpenseCache(userId, monthKeyFromInput(expense.date));

      res.status(201).json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao criar despesa recorrente:', error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao criar despesa recorrente.' });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const payload = buildCreateData(userId, req.body);

      const expense = await prisma.expense.create({ data: payload });
      await invalidateExpenseCache(userId, monthKeyFromInput(expense.date));

      res.status(201).json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      if (error instanceof Error && error.message.includes('Campos obrigatórios')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('recorrente e fixa')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('parcelamento')) {
        return res.status(400).json({ message: error.message });
      }
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
      const existing = await ensureOwnership(prisma, id, userId);

      if (!existing) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      const updateData = buildUpdateData(req.body);
      if (updateData.sharedAmount !== undefined && updateData.sharedAmount !== null) {
        const newAmountSource = (updateData.amount ?? existing.amount) as string | number | null;
        const sharedSource = updateData.sharedAmount as string | number | null;
        if (parseDecimal(sharedSource) > parseDecimal(newAmountSource)) {
          return res.status(400).json({ message: 'sharedAmount > amount' });
        }
      }

      const expense = await prisma.expense.update({
        where: { id },
        data: updateData,
      });
      await invalidateExpenseCache(
        userId,
        monthKeyFromInput(existing.date),
        monthKeyFromInput(expense.date)
      );

      res.json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao atualizar despesa:', error);
      if (error instanceof Error && error.message.includes('recorrente e fixa')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('parcelamento')) {
        return res.status(400).json({ message: error.message });
      }
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
      await invalidateExpenseCache(userId, monthKeyFromInput(existing.date));

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

      const existing = await ensureOwnership(prisma, id, userId);
      if (!existing) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      let cloneDate = customDate ? new Date(customDate) : new Date(existing.date);
      if (existing.recurring) {
        cloneDate = addByRecurrence(existing.date, existing.recurrenceType as RecurrenceType);
      } else if (!customDate && incrementMonth) {
        cloneDate = addByRecurrence(existing.date, 'monthly');
      }

      const amountSeed = parseDecimal(existing.amount);
      const amountValueForCreate = toDecimalString(existing.amount);
      const sharedSeed = existing.sharedAmount != null ? parseDecimal(existing.sharedAmount) : 0;
      const sharedValueForCreate =
        existing.sharedAmount != null ? toDecimalString(existing.sharedAmount) : undefined;
      const monthKey = format(cloneDate, 'yyyy-MM');
      const fingerprintSeed = [
        userId,
        monthKey,
        existing.description,
        amountSeed,
        existing.originId ?? '-',
        existing.debtorId ?? '-',
      ].join('|');
      const fingerprint = generateFingerprint(fingerprintSeed);

      const duplicated = await prisma.expense.create({
        data: buildCreateData(userId, {
          description: existing.description,
          category: existing.category,
          parcela: existing.parcela,
          amount: amountValueForCreate as number | string,
          date: cloneDate.toISOString(),
          originId: existing.originId ?? undefined,
          debtorId: existing.debtorId ?? undefined,
          recurring: existing.recurring,
          recurrenceType: existing.recurrenceType as RecurrenceType,
          fixed: existing.fixed,
          installments: existing.installments,
          sharedWith: existing.sharedWith,
          sharedAmount: sharedValueForCreate,
          fingerprint,
        }),
      });
      await invalidateExpenseCache(userId, monthKey);

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
      const existing = await ensureOwnership(prisma, id, userId);

      if (!existing) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      const updateData = buildUpdateData(req.body);
      if (updateData.amount !== undefined || updateData.sharedAmount !== undefined) {
        const futureAmountSource = (updateData.amount ?? existing.amount) as string | number | null;
        const sharedSource =
          updateData.sharedAmount === undefined ? existing.sharedAmount : updateData.sharedAmount;
        if (
          sharedSource != null &&
          parseDecimal(sharedSource as string | number | null) > parseDecimal(futureAmountSource)
        ) {
          return res.status(400).json({ message: 'Valor compartilhado não pode ser maior que o total.' });
        }
      }

      try {
        validateFlags(updateData.recurring as boolean | undefined, updateData.fixed as boolean | undefined);
      } catch (validationError) {
        if (validationError instanceof Error) {
          return res.status(400).json({ message: validationError.message });
        }
      }

      const updated = await prisma.expense.update({
        where: { id },
        data: updateData,
      });
      await invalidateExpenseCache(
        userId,
        monthKeyFromInput(existing.date),
        monthKeyFromInput(updated.date)
      );

      res.json(serializeExpense(updated));
    } catch (error) {
      console.error('Erro ao ajustar despesa:', error);
      res.status(500).json({ message: 'Erro interno ao ajustar despesa.' });
    }
  });

  router.post('/recurring/queue', async (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      await publishRecurringJob(userId);
      res.json({ ok: true, queued: true });
    } catch (error) {
      console.error('Failed to queue recurring job:', error);
      res.status(500).json({ ok: false });
    }
  });

  return router;
}
