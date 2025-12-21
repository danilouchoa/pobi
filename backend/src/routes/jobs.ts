import { Router } from 'express';
import { requireEmailVerified } from '../middlewares/emailVerified';
import { type AuthenticatedRequest } from '../middlewares/auth';
import { notFound, requireAuthUserId } from '../utils/tenantScope';
import type { PrismaClientLike } from '../types/prisma';

export default function jobsRoutes(prisma: PrismaClientLike) {
  const router = Router();

  router.use(requireEmailVerified(prisma));

  router.get('/:id/status', async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const { id } = req.params;
    const job = await prisma.job.findFirst({
      where: { id, userId },
    });

    if (!job) {
      return notFound(res);
    }

    return res.json(job);
  });

  return router;
}
