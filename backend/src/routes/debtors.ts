import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { validate } from '../middlewares/validation';
import { notFound, requireAuthUserId, tenantWhere } from '../utils/tenantScope';
import {
  createDebtorSchema,
  updateDebtorSchema,
  queryDebtorSchema,
  idParamSchema,
} from '../schemas/catalog.schema';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const serializeDebtor = (debtor: { id: string; name: string; status: string | null; active: boolean }) => ({
  id: debtor.id,
  name: debtor.name,
  status: debtor.status,
  active: debtor.active,
});

export default function debtorsRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', validate({ query: queryDebtorSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = requireAuthUserId(req, res);
      if (!userId) return;

      const debtors = await prisma.debtor.findMany({
        where: tenantWhere(userId),
        orderBy: { name: 'asc' },
      });
      res.json(debtors.map(serializeDebtor));
    } catch (error) {
      console.error('Erro ao listar devedores:', error);
      res.status(500).json({ message: 'Erro interno ao listar devedores.' });
    }
  });

  router.post('/', validate({ body: createDebtorSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = requireAuthUserId(req, res);
      if (!userId) return;

      const { name } = req.body as { name?: string; userId?: string };
      if (!name) return res.status(400).json({ message: 'Nome é obrigatório.' });

      const debtor = await prisma.debtor.create({ data: { name, userId } });
      res.status(201).json(serializeDebtor(debtor));
    } catch (error) {
      console.error('Erro ao criar devedor:', error);
      res.status(500).json({ message: 'Erro interno ao criar devedor.' });
    }
  });

  router.put('/:id', validate({ params: idParamSchema, body: updateDebtorSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = requireAuthUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      const { name, status, active } = req.body as {
        name?: string;
        status?: string | null;
        active?: boolean;
        userId?: string;
      };

      const updateResult = await prisma.debtor.updateMany({
        where: { id, userId },
        data: { name, status, active },
      });

      if (updateResult.count === 0) {
        return notFound(res);
      }

      const debtor = await prisma.debtor.findFirst({ where: { id, userId } });
      if (!debtor) {
        return notFound(res);
      }
      res.json(serializeDebtor(debtor));
    } catch (error) {
      console.error('Erro ao atualizar devedor:', error);
      res.status(500).json({ message: 'Erro interno ao atualizar devedor.' });
    }
  });

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = requireAuthUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      const { name, status, active } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (status !== undefined) data.status = status;
      if (active !== undefined) data.active = Boolean(active);

      const updateResult = await prisma.debtor.updateMany({
        where: { id, userId },
        data,
      });
      if (updateResult.count === 0) {
        return notFound(res);
      }

      const debtor = await prisma.debtor.findFirst({ where: { id, userId } });
      if (!debtor) {
        return notFound(res);
      }
      res.json(serializeDebtor(debtor));
    } catch (error) {
      console.error('Erro ao atualizar devedor (PATCH):', error);
      res.status(500).json({ message: 'Erro interno ao atualizar devedor.' });
    }
  });

  router.delete('/:id', validate({ params: idParamSchema }), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = requireAuthUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      const result = await prisma.debtor.deleteMany({ where: { id, userId } });
      if (result.count === 0) {
        return notFound(res);
      }
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir devedor:', error);
      res.status(500).json({ message: 'Erro interno ao excluir devedor.' });
    }
  });

  return router;
}
