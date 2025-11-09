import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { getOrSetCache } from '../lib/redisCache';
import { redis } from '../lib/redisClient';
import { validate } from '../middlewares/validation';
import {
  createSalarySchema,
  updateSalarySchema,
  querySalarySchema,
  idParamSchema,
} from '../schemas/salary.schema';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const serializeSalaryHistory = (record: {
  id: string;
  month: string;
  hours: number;
  hourRate: number;
  taxRate: number;
  cnae: string | null;
  userId: string;
}) => ({
  id: record.id,
  month: record.month,
  hours: record.hours,
  hourRate: record.hourRate,
  taxRate: record.taxRate,
  cnae: record.cnae,
  userId: record.userId,
});

const handlePrismaError = (error: unknown, res: Response) => {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Registro duplicado (violação de constraint Prisma).' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    console.error('Prisma error (salary history):', error);
    return res.status(400).json({ error: 'Falha ao acessar o banco de dados.' });
  }

  if (error instanceof Error) {
    console.error('Erro interno na operação de histórico salarial:', error);
  } else {
    console.error('Erro desconhecido na operação de histórico salarial:', error);
  }

  return res.status(500).json({ error: 'Erro interno na operação de histórico salarial.' });
};

const isValidMonthParam = (value?: string): value is string => Boolean(value && /^\d{4}-\d{2}$/.test(value));

const buildSalaryCacheKey = (userId: string, monthKey = 'all') =>
  `finance:salary:${userId}:${monthKey}`;

const invalidateSalaryCache = async (userId: string, ...months: Array<string | null | undefined>) => {
  const keys = new Set<string>([buildSalaryCacheKey(userId, 'all')]);
  months.forEach((month) => {
    if (isValidMonthParam(month ?? undefined)) {
      keys.add(buildSalaryCacheKey(userId, month as string));
    }
  });
  await redis.del(...Array.from(keys));
};

export default function salaryHistoryRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', validate({ query: querySalarySchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const monthFilter =
        typeof req.query.month === 'string' && isValidMonthParam(req.query.month)
          ? req.query.month
          : undefined;
      const cacheKey = buildSalaryCacheKey(userId, monthFilter ?? 'all');
      const records = await getOrSetCache(cacheKey, async () => {
        const where = monthFilter ? { userId, month: monthFilter } : { userId };
        const found = await prisma.salaryHistory.findMany({
          where,
          orderBy: { month: 'desc' },
        });
        return found.map(serializeSalaryHistory);
      });

      res.json(records);
    } catch (error: unknown) {
      console.error('Erro ao listar histórico salarial:', error);
      return handlePrismaError(error, res);
    }
  });

  router.post('/', validate({ body: createSalarySchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { month, hours, hourRate, taxRate, cnae } = req.body;
      if (!month || hours == null || hourRate == null || taxRate == null) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
      }

      const record = await prisma.salaryHistory.create({
        data: {
          month,
          hours: Number(hours),
          hourRate: Number(hourRate),
          taxRate: Number(taxRate),
          cnae,
          userId,
        },
      });

      await invalidateSalaryCache(userId, month);
      res.status(201).json(serializeSalaryHistory(record));
    } catch (error: unknown) {
      console.error('Erro ao criar histórico salarial:', error);
      return handlePrismaError(error, res);
    }
  });

  router.put('/:id', validate({ params: idParamSchema, body: updateSalarySchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.salaryHistory.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Registro não encontrado.' });
      }

      const { month, hours, hourRate, taxRate, cnae } = req.body;

      const record = await prisma.salaryHistory.update({
        where: { id },
        data: {
          month,
          hours: hours == null ? undefined : Number(hours),
          hourRate: hourRate == null ? undefined : Number(hourRate),
          taxRate: taxRate == null ? undefined : Number(taxRate),
          cnae,
        },
      });

      await invalidateSalaryCache(userId, existing.month, record.month);
      res.json(serializeSalaryHistory(record));
    } catch (error: unknown) {
      console.error('Erro ao atualizar histórico salarial:', error);
      return handlePrismaError(error, res);
    }
  });

  router.delete('/:id', validate({ params: idParamSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.salaryHistory.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Registro não encontrado.' });
      }

      await prisma.salaryHistory.delete({ where: { id } });
      await invalidateSalaryCache(userId, existing.month);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Erro ao excluir histórico salarial:', error);
      return handlePrismaError(error, res);
    }
  });

  return router;
}
