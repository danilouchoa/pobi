import { Router, Request, Response } from 'express';
import { PrismaClient, Origin, Expense, Prisma } from '@prisma/client';
import crypto from 'crypto';
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
import { deleteExpenseCascade, deleteExpenseById } from '../services/installmentDeletionService';
import {
  ExpenseViewMode,
  buildExpenseCacheKey,
  monthKeyFromInput,
  buildInvalidationEntries,
  invalidateExpenseCache,
} from '../utils/expenseCache';
import { bulkJobSchema, bulkUnifiedActionSchema, type BulkUnifiedActionPayload } from '../schemas/bulkUpdate.schema';
import { ZodError, ZodIssue } from 'zod';
import { validate } from '../middlewares/validation';
import {
  createExpenseSchema,
  createExpenseBatchSchema,
  updateExpenseSchema,
  queryExpenseSchema,
  idParamSchema,
  MAX_BATCH_SIZE,
} from '../schemas/expense.schema';

// Timeout para transações de batch (suporta até MAX_BATCH_SIZE parcelas)
const BATCH_TRANSACTION_TIMEOUT_MS = 30000; // 30 segundos

type AuthenticatedRequest = Request<
  Record<string, string>,
  any,
  ExpensePayload | ExpensePayload[] | BulkUnifiedActionPayload | any,
  Record<string, unknown>
> & {
  userId?: string;
};

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

const computeBillingMonth = async (
  prisma: PrismaClient | Prisma.TransactionClient,
  originId: string | null,
  date: Date,
  originCache?: Map<string, Origin | null>
): Promise<string | null> => {
  if (!originId) return null;
  let origin: Origin | null = null;
  if (originCache && originCache.has(originId)) {
    origin = originCache.get(originId) ?? null;
  } else {
    origin = await prisma.origin.findUnique({ where: { id: originId } });
    if (originCache) originCache.set(originId, origin);
  }
  if (!origin || !shouldApplyBillingLogic(origin.type)) {
    return null;
  }
  const closingDay = origin.closingDay ?? null;
  const normalizedClosingDay = closingDay != null ? Math.trunc(closingDay) : null;
  if (!normalizedClosingDay || normalizedClosingDay < 1 || normalizedClosingDay > 31) {
    throw new BillingConfigurationError(
      'Cartão de crédito deve ter dia de fechamento configurado (1-31).'
    );
  }
  const policy = (origin.billingRolloverPolicy ?? 'PREVIOUS') as BillingRolloverPolicy;
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
  installmentGroupId: expense.installmentGroupId ?? null,
});

export default function expensesRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', validate({ query: queryExpenseSchema }), async (req: AuthenticatedRequest, res: Response) => {
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

  router.post('/bulkUpdate', async (req: AuthenticatedRequest, res: Response) => {
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
          ).map((expense: { id: string }) => expense.id)
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
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const zodError = error as ZodError;
        const message = zodError.errors.map((issue: ZodIssue) => issue.message).join(', ');
        return res.status(400).json({ message });
      }
      console.error('Erro ao enfileirar edição em massa:', error);
      return res.status(500).json({ message: 'Erro interno ao agendar edição em massa.' });
    }
  });

  // Endpoint unificado /bulk para update/delete (síncrono)
  router.post('/bulk', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const parsed = bulkUnifiedActionSchema.parse(req.body) as BulkUnifiedActionPayload;

      if (parsed.action === 'delete') {
        const uniqueIds = Array.from(new Set(parsed.ids as string[]));
        const { deletedCount } = await applyBulkDelete(prisma, userId, uniqueIds);
        console.info(`[bulk] delete user=${userId} ids=${uniqueIds.length} deleted=${deletedCount}`);
        return res.json({ deletedCount, updatedCount: 0, status: 'ok' });
      } else if (parsed.action === 'update') {
        const items = parsed.items;
        const { updatedCount } = await applyBulkUnifiedUpdate(prisma, userId, items);
        console.info(`[bulk] update user=${userId} items=${items.length} updated=${updatedCount}`);
        return res.json({ deletedCount: 0, updatedCount, status: 'ok' });
      }
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const zodError = error as ZodError;
        const message = zodError.errors.map((issue: ZodIssue) => issue.message).join(', ');
        return res.status(400).json({ message });
      }
      console.error('Erro em /bulk:', error);
      return res.status(500).json({ message: 'Erro interno na operação em massa.' });
    }
  });
  router.get('/recurring', async (req: AuthenticatedRequest, res: Response) => {
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

  router.get('/shared', async (req: AuthenticatedRequest, res: Response) => {
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

  router.post('/recurring', async (req: AuthenticatedRequest, res: Response) => {
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

  router.post('/batch', validate({ body: createExpenseBatchSchema }), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const payloads = Array.isArray(req.body) ? (req.body as ExpensePayload[]) : [];

      if (!payloads.length) {
        return res.status(400).json({ message: 'Informe ao menos uma despesa.' });
      }

      const createData = payloads.map((payload) => buildCreateData(userId, payload));

      // Detecta se é parcelado: pelo menos uma parcela com installments > 1 em um lote
      const installmentCandidates = createData.filter((payload) => {
        const installments = payload.installments ?? null;
        return installments != null && installments > 1;
      });
      const isInstallment = createData.length > 1 && installmentCandidates.length > 0;

      // Gera (ou reaproveita) um único groupId se for parcelado
      const groupId = isInstallment
        ? createData.find((payload) => payload.installmentGroupId)?.installmentGroupId ??
          crypto.randomBytes(12).toString('hex')
        : null;

      if (isInstallment && groupId) {
        console.info('[expenses.batch] Parcelamento detectado', {
          parcelas: createData.length,
          parcelasComInstallments: installmentCandidates.length,
          installmentGroupId: groupId,
        });
      }

      const createDataWithGroup = createData.map((payload, index) => {
        const installments = payload.installments ?? null;
        const parcela = installments && installments > 1 ? `${index + 1}/${installments}` : payload.parcela;

        if (isInstallment && groupId) {
          const data = {
            ...payload,
            parcela,
            installmentGroupId: groupId,
          };
          console.info('[expenses.batch] Criando parcela', {
            parcela: `${index + 1}/${createData.length}`,
            installmentGroupId: groupId,
          });
          return data;
        }

        return { ...payload, parcela };
      });
      const originCache = new Map<string, Origin | null>();

      const expenses: Expense[] = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created: Expense[] = [];
        for (const data of createDataWithGroup) {
          const billingMonth = await computeBillingMonth(tx, data.originId ?? null, data.date, originCache);
          const expense = await tx.expense.create({ data: { ...data, billingMonth } });
          created.push(expense);
        }
        return created;
      }, {
        maxWait: BATCH_TRANSACTION_TIMEOUT_MS,
        timeout: BATCH_TRANSACTION_TIMEOUT_MS,
      });

      const invalidationMap = new Map<string, { month: string; mode: 'calendar' | 'billing' }>();
      expenses.forEach((expense: Expense) => {
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

  router.delete('/group/:groupId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { groupId } = req.params;
      if (!groupId) {
        return res.status(400).json({ message: 'groupId é obrigatório.' });
      }

      const pivotExpense = await prisma.expense.findFirst({
        where: {
          userId,
          installmentGroupId: groupId,
        },
        select: {
          id: true,
          description: true,
          parcela: true,
          amount: true,
          originId: true,
          debtorId: true,
          installments: true,
          date: true,
          billingMonth: true,
          fingerprint: true,
          installmentGroupId: true,
        },
      });

      if (!pivotExpense) {
        return res.status(404).json({ message: 'Nenhuma parcela encontrada para o grupo informado.' });
      }

      const cascadeResult = await prisma.$transaction((tx) =>
        deleteExpenseCascade(tx, userId, pivotExpense as any)
      );

      if (!cascadeResult.deleted.length) {
        return res.status(404).json({ message: 'Nenhuma parcela encontrada para o grupo informado.' });
      }

      const invalidations = collectInvalidationTargets(
        cascadeResult.deleted.map((expense) => ({
          date: expense.date,
          billingMonth: expense.billingMonth,
        }))
      );

      if (invalidations.length) {
        await invalidateExpenseCache(userId, invalidations);
      }

      return res.json({ message: 'Todas as parcelas foram removidas com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir grupo de despesas:', error);
      return res.status(500).json({ message: 'Erro interno ao excluir grupo de despesas.' });
    }
  });

  router.post('/', validate({ body: createExpenseSchema }), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const payload = buildCreateData(userId, req.body);
      // Se for parcela única, installmentGroupId = null
      // Se for parcela (ex: "1/12"), gera um groupId se não vier do batch
      let dataToCreate = { ...payload };
      if (payload.parcela && typeof payload.parcela === 'string') {
        const normalizedParcela = payload.parcela.replace(/\s+/g, '');
        const isInstallment = INSTALLMENT_FORMAT_REGEX.test(normalizedParcela);
        if (isInstallment) {
          dataToCreate = {
            ...dataToCreate,
            installmentGroupId: crypto.randomBytes(12).toString('hex'),
          };
        }
      }
      const billingMonth = await computeBillingMonth(prisma, payload.originId ?? null, payload.date);
      const expense = await prisma.expense.create({ data: { ...dataToCreate, billingMonth } });
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

  router.put('/:id', validate({ params: idParamSchema, body: updateExpenseSchema }), async (req: AuthenticatedRequest, res: Response) => {
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

  router.delete('/:id', validate({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Não autorizado.' });
      }

      const { id } = req.params;

      const cascadeResult = await deleteExpenseById(prisma, userId, id);

      if (!cascadeResult) {
        return res.status(404).json({ message: 'Despesa não encontrada.' });
      }

      const invalidations = collectInvalidationTargets(cascadeResult.deleted);

      if (invalidations.length) {
        await invalidateExpenseCache(userId, invalidations);
      }

      return res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      res.status(500).json({ message: 'Erro interno ao excluir despesa.' });
    }
  });

  router.post('/:id/duplicate', async (req: AuthenticatedRequest, res: Response) => {
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

  router.patch('/:id/adjust', async (req: AuthenticatedRequest, res: Response) => {
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

  router.post('/recurring/queue', async (req: AuthenticatedRequest, res: Response) => {
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
const INSTALLMENT_FORMAT_REGEX = /^\d{1,3}\/\d{1,3}$/;

const collectInvalidationTargets = (
  expenses: Array<{ date: Date; billingMonth: string | null }>
) => {
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
  return Array.from(invalidationMap.values());
};
