import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const serializeOrigin = (origin: {
  id: string;
  name: string;
  type: string;
  dueDay: string | null;
  limit: number | null;
  status: string | null;
  active: boolean;
}) => ({
  id: origin.id,
  name: origin.name,
  type: origin.type,
  dueDay: origin.dueDay,
  limit: origin.limit,
  status: origin.status,
  active: origin.active,
});

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

      const { name, type, dueDay, limit } = req.body;
      if (!name || !type) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
      }

      const numericLimit = limit == null ? null : Number(limit);
      const origin = await prisma.origin.create({
        data: { name, type, dueDay, limit: numericLimit, userId },
      });

      res.status(201).json(serializeOrigin(origin));
    } catch (error) {
      console.error('Erro ao criar origem:', error);
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

      const { name, type, dueDay, limit, status, active } = req.body;
      const numericLimit = limit == null ? undefined : Number(limit);

      const origin = await prisma.origin.update({
        where: { id },
        data: {
          name,
          type,
          dueDay,
          limit: Number.isNaN(numericLimit as number) ? undefined : numericLimit,
          status,
          active,
        },
      });

      res.json(serializeOrigin(origin));
    } catch (error) {
      console.error('Erro ao atualizar origem:', error);
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

      const { name, type, dueDay, limit, status, active } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (type !== undefined) data.type = type;
      if (dueDay !== undefined) data.dueDay = dueDay;
      if (status !== undefined) data.status = status;
      if (active !== undefined) data.active = Boolean(active);
      if (limit !== undefined) {
        const numeric = Number(limit);
        if (!Number.isNaN(numeric)) {
          data.limit = numeric;
        } else if (limit === null) {
          data.limit = null;
        }
      }

      const origin = await prisma.origin.update({
        where: { id },
        data,
      });

      res.json(serializeOrigin(origin));
    } catch (error) {
      console.error('Erro ao atualizar parcialmente a origem:', error);
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
