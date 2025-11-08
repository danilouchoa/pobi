import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import type { $Enums } from '@prisma/client';
import { parseDecimal, toDecimalString, toDecimalStringOrNull } from '../utils/formatters';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const serializeOrigin = (origin: {
  id: string;
  name: string;
  type: string;
  dueDay: string | null;
  limit: any;
  status: string | null;
  active: boolean;
  closingDay?: number | null;
  billingRolloverPolicy?: string | null;
}) => ({
  id: origin.id,
  name: origin.name,
  type: origin.type,
  dueDay: origin.dueDay,
  limit: origin.limit != null ? parseDecimal(origin.limit) : null,
  status: origin.status,
  active: origin.active,
  closingDay: origin.closingDay ?? null,
  billingRolloverPolicy: origin.billingRolloverPolicy ?? null,
});

const parseClosingDayInput = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) {
    throw new Error('closingDay deve ser um número entre 1 e 31.');
  }
  return Math.trunc(parsed);
};

const toRolloverPolicy = (
  value?: string | null
): $Enums.BillingRolloverPolicy | null => {
  if (value === 'PREVIOUS_BUSINESS_DAY') return 'PREVIOUS_BUSINESS_DAY';
  if (value === 'NEXT_BUSINESS_DAY') return 'NEXT_BUSINESS_DAY';
  return null;
};

const parseBillingPolicy = (
  value: unknown
): $Enums.BillingRolloverPolicy | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string') {
    const policy = toRolloverPolicy(value);
    if (policy) return policy;
  }
  throw new Error('billingRolloverPolicy inválida.');
};

export default function originsRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const origins = await prisma.origin.findMany({ where: { userId }, orderBy: { name: 'asc' } });
      res.json(origins.map(serializeOrigin));
    } catch (error) {
      console.error('Erro ao listar origens:', error);
      res.status(500).json({ message: 'Erro interno ao listar origens.' });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { name, type, dueDay, limit, closingDay, billingRolloverPolicy } = req.body;
      if (!name || !type) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
      }

      const closingDayValue = parseClosingDayInput(closingDay);
      const policyValue = parseBillingPolicy(billingRolloverPolicy);

      const origin = await prisma.origin.create({
        data: {
          name,
          type,
          dueDay,
          limit: toDecimalStringOrNull(limit),
          closingDay: closingDayValue,
          billingRolloverPolicy: policyValue ?? null,
          userId,
        },
      });

      res.status(201).json(serializeOrigin(origin));
    } catch (error) {
      console.error('Erro ao criar origem:', error);
      if (
        error instanceof Error &&
        (error.message.includes('closingDay') || error.message.includes('billingRolloverPolicy'))
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao criar origem.' });
    }
  });

  router.put('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.origin.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Origem não encontrada.' });
      }

      const { name, type, dueDay, limit, status, active, closingDay, billingRolloverPolicy } = req.body;

      const closingDayValue = parseClosingDayInput(closingDay);
      const policyValue = parseBillingPolicy(billingRolloverPolicy);

      const origin = await prisma.origin.update({
        where: { id },
        data: {
          name,
          type,
          dueDay,
          limit: limit === undefined ? undefined : toDecimalStringOrNull(limit),
          status,
          active,
          closingDay: closingDayValue,
          billingRolloverPolicy: policyValue ?? null,
        },
      });

      res.json(serializeOrigin(origin));
    } catch (error) {
      console.error('Erro ao atualizar origem:', error);
      if (
        error instanceof Error &&
        (error.message.includes('closingDay') || error.message.includes('billingRolloverPolicy'))
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao atualizar origem.' });
    }
  });

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.origin.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Origem não encontrada.' });
      }

      const { name, type, dueDay, limit, status, active, closingDay, billingRolloverPolicy } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (type !== undefined) data.type = type;
      if (dueDay !== undefined) data.dueDay = dueDay;
      if (status !== undefined) data.status = status;
      if (active !== undefined) data.active = Boolean(active);
      if (limit !== undefined) {
        data.limit = limit === null ? null : toDecimalString(limit);
      }
      if (closingDay !== undefined) {
        data.closingDay = parseClosingDayInput(closingDay);
      }
      if (billingRolloverPolicy !== undefined) {
        data.billingRolloverPolicy = parseBillingPolicy(billingRolloverPolicy) ?? null;
      }

      const origin = await prisma.origin.update({
        where: { id },
        data,
      });

      res.json(serializeOrigin(origin));
    } catch (error) {
      console.error('Erro ao atualizar parcialmente a origem:', error);
      if (
        error instanceof Error &&
        (error.message.includes('closingDay') || error.message.includes('billingRolloverPolicy'))
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro interno ao atualizar origem.' });
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.origin.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Origem não encontrada.' });
      }

      await prisma.origin.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir origem:', error);
      res.status(500).json({ message: 'Erro interno ao excluir origem.' });
    }
  });

  return router;
}
