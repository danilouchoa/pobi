import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireEmailVerified } from '../middlewares/emailVerified';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export default function jobsRoutes(prisma: PrismaClient) {
  const router = Router();

  router.use(requireEmailVerified(prisma));

  router.get('/:id/status', async (req: AuthenticatedRequest, res) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Não autorizado.' });

    const { id } = req.params;
    const job = await prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job não encontrado.' });
    }

    return res.json(job);
  });

  return router;
}
