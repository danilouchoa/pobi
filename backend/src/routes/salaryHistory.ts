import { Router, Request } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

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

const handlePrismaError = (error: unknown, res: any) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res
      .status(409)
      .json({ error: 'Registro duplicado (violação de constraint Prisma).' });
  }

  return res.status(500).json({ message: 'Erro interno na operação de histórico salarial.' });
};

export default function salaryHistoryRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const records = await prisma.salaryHistory.findMany({
        where: { userId },
        orderBy: { month: 'desc' },
      });

      res.json(records.map(serializeSalaryHistory));
    } catch (error) {
      console.error('Erro ao listar histórico salarial:', error);
      res.status(500).json({ message: 'Erro interno ao listar histórico salarial.' });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
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

      res.status(201).json(serializeSalaryHistory(record));
    } catch (error) {
      console.error('Erro ao criar histórico salarial:', error);
      return handlePrismaError(error, res);
    }
  });

  router.put('/:id', async (req: AuthenticatedRequest, res) => {
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

      res.json(serializeSalaryHistory(record));
    } catch (error) {
      console.error('Erro ao atualizar histórico salarial:', error);
      return handlePrismaError(error, res);
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

      const { id } = req.params;
      const existing = await prisma.salaryHistory.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: 'Registro não encontrado.' });
      }

      await prisma.salaryHistory.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir histórico salarial:', error);
      res.status(500).json({ message: 'Erro interno ao excluir histórico salarial.' });
    }
  });

  return router;
}
