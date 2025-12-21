import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireEmailVerified } from '../middlewares/emailVerified';
import { notFound, requireAuthUserId } from '../utils/tenantScope';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export default function jobsRoutes(prisma: PrismaClient) {
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
