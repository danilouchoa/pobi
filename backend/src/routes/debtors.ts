import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';

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

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const debtors = await prisma.debtor.findMany({ where: { userId }, orderBy: { name: 'asc' } });
      res.json(debtors.map(serializeDebtor));
    } catch (error) {
      console.error('Erro ao listar devedores:', error);
      res.status(500).json({ message: 'Erro interno ao listar devedores.' });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { name } = req.body;
      if (!name) return res.status(400).json({ message: 'Nome é obrigatório.' });

      const debtor = await prisma.debtor.create({ data: { name, userId } });
      res.status(201).json(serializeDebtor(debtor));
    } catch (error) {
      console.error('Erro ao criar devedor:', error);
      res.status(500).json({ message: 'Erro interno ao criar devedor.' });
    }
  });

  router.put('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.debtor.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Devedor não encontrado.' });
      }

      const { name, status, active } = req.body;
      const debtor = await prisma.debtor.update({
        where: { id },
        data: { name, status, active },
      });
      res.json(serializeDebtor(debtor));
    } catch (error) {
      console.error('Erro ao atualizar devedor:', error);
      res.status(500).json({ message: 'Erro interno ao atualizar devedor.' });
    }
  });

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.debtor.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Devedor não encontrado.' });
      }

      const { name, status, active } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (status !== undefined) data.status = status;
      if (active !== undefined) data.active = Boolean(active);

      const debtor = await prisma.debtor.update({ where: { id }, data });
      res.json(serializeDebtor(debtor));
    } catch (error) {
      console.error('Erro ao atualizar devedor (PATCH):', error);
      res.status(500).json({ message: 'Erro interno ao atualizar devedor.' });
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.debtor.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Devedor não encontrado.' });
      }

      await prisma.debtor.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir devedor:', error);
      res.status(500).json({ message: 'Erro interno ao excluir devedor.' });
    }
  });

  return router;
}
