import { Router, Request } from 'express';
import { PrismaClient, Origin, Prisma } from '@prisma/client';
import { addMonths, startOfMonth, format } from 'date-fns';
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
import { publishRecurringJob, publishBulkUpdateJob } from '../lib/rabbit';
import { applyBulkUnifiedUpdate, applyBulkDelete } from '../services/bulkUpdateService';
import { getOrSetCache } from '../lib/redisCache';
import { deriveBillingMonth, BillingRolloverPolicy } from '../lib/billing';
import { deleteExpenseCascade } from '../services/installmentDeletionService';
import {
  ExpenseViewMode,
  buildExpenseCacheKey,
  monthKeyFromInput,
  buildInvalidationEntries,
  invalidateExpenseCache,
} from '../utils/expenseCache';
import { bulkJobSchema, bulkUnifiedActionSchema, type BulkUnifiedActionPayload } from '../schemas/bulkUpdate.schema';
import { ZodError } from 'zod';
import { validate } from '../middlewares/validation';
import {
  createExpenseSchema,
  createExpenseBatchSchema,
  updateExpenseSchema,
  queryExpenseSchema,
  idParamSchema,
} from '../schemas/expense.schema';

interface AuthenticatedRequest extends Request {
  userId?: string;
  body: any;
}

class BillingConfigurationError extends Error {
  statusCode = 422;
  constructor(message = 'Configurar fechamento do cartão.') {
    super(message);
  }
}

const normalizeOriginType = (value?: string | null) =>
  value ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

const shouldApplyBillingLogic = (originType?: string | null) =>
  normalizeOriginType(originType) === 'cartao';

/**
 * Calcula o mês de faturamento (billingMonth) para uma despesa de cartão
 * 
 * Este função é chamada automaticamente ao criar ou editar despesas de cartão,
 * determinando em qual fatura (mês) a despesa deve aparecer.
 * 
 * Fluxo de cálculo:
 * 1. Verifica se a despesa tem uma origin associada
 * 2. Busca dados da origin (tipo, closingDay, policy)
 * 3. Se for tipo "Cartão", valida closingDay e calcula billingMonth
 * 4. Retorna string 'YYYY-MM' ou null (se não for cartão)
 * 
 * @param prisma - Cliente Prisma para queries no banco
 * @param originId - ID da origin (cartão/conta) da despesa
 * @param date - Data da transação/compra
 * @returns billingMonth ('YYYY-MM') ou null
 * @throws BillingConfigurationError se cartão não tem closingDay configurado
 * 
 * @example
 * // Despesa de cartão com fechamento configurado
 * const billingMonth = await computeBillingMonth(prisma, 'origin123', new Date('2025-11-08'));
 * // Retorna: "2025-12" (se compra foi após fechamento)
 * 
 * @example
 * // Despesa de conta corrente (não é cartão)
 * const billingMonth = await computeBillingMonth(prisma, 'origin456', new Date('2025-11-08'));
 * // Retorna: null (contas não têm fatura)
 */
const computeBillingMonth = async (
  prisma: PrismaClient | Prisma.TransactionClient,
  originId: string | null | undefined,
  date: Date,
  originCache?: Map<string, Origin | null>
): Promise<string | null> => {
  // Se despesa não tem origin, não pode ter billingMonth
  if (!originId) return null;

  // Buscar dados da origin (cartão/conta)
  let origin: Origin | null | undefined = null;

  if (originCache) {
    const cached = originCache.get(originId);
    if (cached !== undefined) {
      origin = cached;
    } else {
      origin = await prisma.origin.findUnique({ where: { id: originId } });
      originCache.set(originId, origin ?? null);
    }
  } else {
    origin = await prisma.origin.findUnique({ where: { id: originId } });
  }

  // Se origin não existe ou não é cartão, retorna null
  if (!origin || !shouldApplyBillingLogic(origin.type)) {
    return null;
  }

  // Validar closingDay (dia de fechamento da fatura)
  const closingDay = origin.closingDay ?? null;
  const normalizedClosingDay = closingDay != null ? Math.trunc(closingDay) : null;

  // VALIDAÇÃO CRÍTICA: Cartões DEVEM ter closingDay configurado
  // Se não tiver, retorna erro 422 (Unprocessable Entity)
  if (!normalizedClosingDay || normalizedClosingDay < 1 || normalizedClosingDay > 31) {
    throw new BillingConfigurationError(
      'Cartão de crédito deve ter dia de fechamento configurado (1-31).'
    );
  }

  // Obter política de rollover (padrão: PREVIOUS se não configurado)
  // PREVIOUS = antecipar para sexta se fechamento cair em fim de semana
  // NEXT = adiar para segunda se fechamento cair em fim de semana
  const policy = (origin.billingRolloverPolicy ?? 'PREVIOUS') as BillingRolloverPolicy;

  // Calcular e retornar billingMonth ('YYYY-MM')
  return deriveBillingMonth(date, normalizedClosingDay, policy);
};

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
  billingMonth: expense.billingMonth ?? null,
});


export default function expensesRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', validate({ query: queryExpenseSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const modeParam = typeof req.query.mode === 'string' ? req.query.mode : 'calendar';
      const mode: ExpenseViewMode = modeParam === 'billing' ? 'billing' : 'calendar';
      const monthQuery = typeof req.query.month === 'string' ? req.query.month : undefined;
      const pageParam = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
      const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
      const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.trunc(pageParam) : 1;
      const limitCandidate = Number.isFinite(limitParam) && limitParam > 0 ? Math.trunc(limitParam) : 20;
      const limit = Math.min(Math.max(limitCandidate, 1), 200);

      if (mode === 'billing') {
        if (!monthQuery || !/^\d{4}-\d{2}$/.test(monthQuery)) {
          return res
            .status(400)
            .json({ message: 'Parâmetro month (YYYY-MM) é obrigatório no modo billing.' });
        }

        const cacheKey = buildExpenseCacheKey(userId, monthQuery, 'billing', page, limit);
        const expenses = await getOrSetCache(cacheKey, async () => {
          const where = { userId, billingMonth: monthQuery };
          const [items, total] = await prisma.$transaction([
            prisma.expense.findMany({
              where,
              orderBy: { date: 'desc' },
              skip: (page - 1) * limit,
              take: limit,
            }),
            prisma.expense.count({ where }),
          ]);
          return {
            data: items.map(serializeExpense),
            pagination: {
              page,
              limit,
              total,
              pages: Math.max(1, Math.ceil(total / limit)),
            },
          };
        });
        return res.json(expenses);
      }

      const yearQuery = typeof req.query.year === 'string' ? req.query.year : undefined;

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

      const where = {
        userId,
        date: {
          gte: start,
          lt: end,
        },
      };

      const monthKey = format(start, 'yyyy-MM');
      const cacheKey = buildExpenseCacheKey(userId, monthKey, 'calendar', page, limit);
      const expenses = await getOrSetCache(cacheKey, async () => {
        const [items, total] = await prisma.$transaction([
          prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
          prisma.expense.count({ where }),
        ]);
        return {
          data: items.map(serializeExpense),
          pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
          },
        };
      });

      res.json(expenses);
    } catch (error) {
      console.error('Erro ao listar despesas:', error);
      res.status(500).json({ message: 'Erro interno ao listar despesas.' });
    }
  });

  router.post('/bulkUpdate', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const parsed = bulkJobSchema.parse(req.body);
      const uniqueFilterIds = parsed.filters.expenseIds ? Array.from(new Set(parsed.filters.expenseIds)) : [];
      const expenseIds = uniqueFilterIds.length
        ? (
            await prisma.expense.findMany({
              where: { id: { in: uniqueFilterIds }, userId },
              select: { id: true },
            })
          ).map((expense) => expense.id)
        : [];

      if (!expenseIds.length) {
        return res.status(400).json({ message: 'Nenhuma despesa encontrada para os filtros informados.' });
      }

      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      const job = await prisma.job.create({
        data: {
          type: 'bulkUpdate',
          queue: 'bulkUpdateQueue',
          status: 'pending',
          payload: {
            expenseIds,
            data: parsed.data,
            options: parsed.options,
          },
          userId,
          expiresAt,
        },
      });

      await publishBulkUpdateJob({
        jobId: job.id,
        payload: {
          jobId: job.id,
          filters: parsed.filters,
          options: parsed.options,
        },
      });

      return res.status(202).json({ jobId: job.id, status: 'queued' });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors.map((err) => err.message).join(', ') });
      }
      console.error('Erro ao enfileirar edição em massa:', error);
      return res.status(500).json({ message: 'Erro interno ao agendar edição em massa.' });
    }
  });

  // Endpoint unificado /bulk para update/delete (síncrono)
  router.post('/bulk', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

    const parsed = bulkUnifiedActionSchema.parse(req.body) as BulkUnifiedActionPayload;

      if (parsed.action === 'delete') {
        const uniqueIds = Array.from(new Set(parsed.ids));
        const { deletedCount } = await applyBulkDelete(prisma, userId, uniqueIds);
        console.info(`[bulk] delete user=${userId} ids=${uniqueIds.length} deleted=${deletedCount}`);
        return res.json({ deletedCount, updatedCount: 0, status: 'ok' });
      } else if (parsed.action === 'update') {
        const items = parsed.items;
        const { updatedCount } = await applyBulkUnifiedUpdate(prisma, userId, items);
        console.info(`[bulk] update user=${userId} items=${items.length} updated=${updatedCount}`);
        return res.json({ deletedCount: 0, updatedCount, status: 'ok' });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors.map(e => e.message).join(', ') });
      }
      console.error('Erro em /bulk:', error);
      return res.status(500).json({ message: 'Erro interno na operação em massa.' });
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

      const billingMonth = await computeBillingMonth(prisma, payload.originId ?? null, payload.date);
      const expense = await prisma.expense.create({ data: { ...payload, billingMonth } });
      await invalidateExpenseCache(
        userId,
        buildInvalidationEntries(
          monthKeyFromInput(expense.date),
          expense.billingMonth ?? billingMonth ?? null
        )
      );

      res.status(201).json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao criar despesa recorrente:', error);
      if (error instanceof BillingConfigurationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao criar despesa recorrente.' });
    }
  });

  router.post('/batch', validate({ body: createExpenseBatchSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const payloads = Array.isArray(req.body) ? req.body : [];

      if (!payloads.length) {
        return res.status(400).json({ message: 'Informe ao menos uma despesa.' });
      }

      const createData = payloads.map((payload) => buildCreateData(userId, payload));
      const originCache = new Map<string, Origin | null>();

      // Aumentar timeout para 30 segundos para suportar criação de muitas parcelas
      const expenses = await prisma.$transaction(async (tx) => {
        const created = [] as any[];
        for (const data of createData) {
          const billingMonth = await computeBillingMonth(tx, data.originId ?? null, data.date, originCache);
          const expense = await tx.expense.create({ data: { ...data, billingMonth } });
          created.push(expense);
        }
        return created;
      }, {
        maxWait: 30000, // 30 segundos de espera máxima
        timeout: 30000, // 30 segundos de timeout
      });

      const invalidationMap = new Map<string, { month: string; mode: 'calendar' | 'billing' }>();
      expenses.forEach((expense) => {
        const entries = buildInvalidationEntries(
          monthKeyFromInput(expense.date),
          expense.billingMonth ?? null
        );
        entries.forEach((entry) => {
          if (!entry.month) return;
          const key = `${entry.mode}:${entry.month}`;
          if (!invalidationMap.has(key)) {
            invalidationMap.set(key, { month: entry.month, mode: entry.mode });
          }
        });
      });

      if (invalidationMap.size) {
        await invalidateExpenseCache(userId, Array.from(invalidationMap.values()));
      }

      res.status(201).json(expenses.map(serializeExpense));
    } catch (error) {
      console.error('Erro ao criar despesas em lote:', error);
      if (error instanceof BillingConfigurationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('Campos obrigatórios')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('recorrente e fixa')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('parcelamento')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao criar despesas.' });
    }
  });

  router.post('/', validate({ body: createExpenseSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const payload = buildCreateData(userId, req.body);

      const billingMonth = await computeBillingMonth(prisma, payload.originId ?? null, payload.date);
      const expense = await prisma.expense.create({ data: { ...payload, billingMonth } });
      await invalidateExpenseCache(
        userId,
        buildInvalidationEntries(
          monthKeyFromInput(expense.date),
          expense.billingMonth ?? billingMonth ?? null
        )
      );

      res.status(201).json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      if (error instanceof BillingConfigurationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
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

  router.put('/:id', validate({ params: idParamSchema, body: updateExpenseSchema }), async (req: AuthenticatedRequest, res) => {
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

      const nextDate = (updateData.date as Date | undefined) ?? new Date(existing.date);
      const nextOriginId =
        (updateData.originId as string | null | undefined) ?? existing.originId ?? null;
      const billingMonth = await computeBillingMonth(prisma, nextOriginId, nextDate);
      updateData.billingMonth = billingMonth;

      const expense = await prisma.expense.update({
        where: { id },
        data: updateData,
      });
      await invalidateExpenseCache(userId, [
        ...buildInvalidationEntries(
          monthKeyFromInput(existing.date),
          existing.billingMonth ?? null
        ),
        ...buildInvalidationEntries(
          monthKeyFromInput(expense.date),
          expense.billingMonth ?? billingMonth ?? null
        ),
      ]);

      res.json(serializeExpense(expense));
    } catch (error) {
      console.error('Erro ao atualizar despesa:', error);
      if (error instanceof BillingConfigurationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('recorrente e fixa')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('parcelamento')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao atualizar despesa.' });
    }
  });

  router.delete('/:id', validate({ params: idParamSchema }), async (req: AuthenticatedRequest, res) => {
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

      const cascadeResult = await deleteExpenseCascade(prisma, userId, existing as any);

      const invalidationMap = new Map<string, { month: string; mode: 'calendar' | 'billing' }>();
      cascadeResult.deleted.forEach((expense) => {
        const entries = buildInvalidationEntries(
          monthKeyFromInput(expense.date),
          expense.billingMonth ?? null
        );
        entries.forEach((entry) => {
          if (!entry.month) return;
          const key = `${entry.mode}:${entry.month}`;
          if (!invalidationMap.has(key)) {
            invalidationMap.set(key, { month: entry.month, mode: entry.mode });
          }
        });
      });

      if (invalidationMap.size) {
        await invalidateExpenseCache(userId, Array.from(invalidationMap.values()));
      }

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

      const createPayload = buildCreateData(userId, {
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
      });
      const billingMonth = await computeBillingMonth(
        prisma,
        createPayload.originId ?? null,
        createPayload.date
      );
      const duplicated = await prisma.expense.create({
        data: { ...createPayload, billingMonth },
      });
      await invalidateExpenseCache(
        userId,
        buildInvalidationEntries(monthKey, duplicated.billingMonth ?? billingMonth ?? null)
      );

      res.status(201).json(serializeExpense(duplicated));
    } catch (error) {
      console.error('Erro ao duplicar despesa:', error);
      if (error instanceof BillingConfigurationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
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

      const adjustedDate = (updateData.date as Date | undefined) ?? new Date(existing.date);
      const adjustedOriginId =
        (updateData.originId as string | null | undefined) ?? existing.originId ?? null;
      const billingMonth = await computeBillingMonth(prisma, adjustedOriginId, adjustedDate);
      updateData.billingMonth = billingMonth;

      const updated = await prisma.expense.update({
        where: { id },
        data: updateData,
      });
      await invalidateExpenseCache(userId, [
        ...buildInvalidationEntries(
          monthKeyFromInput(existing.date),
          existing.billingMonth ?? null
        ),
        ...buildInvalidationEntries(
          monthKeyFromInput(updated.date),
          updated.billingMonth ?? billingMonth ?? null
        ),
      ]);

      res.json(serializeExpense(updated));
    } catch (error) {
      console.error('Erro ao ajustar despesa:', error);
      if (error instanceof BillingConfigurationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
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
