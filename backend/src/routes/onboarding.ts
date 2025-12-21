import { Router, Response } from 'express';
import { type AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { onboardingPatchSchema } from '../schemas/onboarding.schema';
import {
  completeOnboarding,
  dismissOnboarding,
  getOnboardingState,
  patchOnboarding,
} from '../services/onboarding';
import { requireAuthUserId } from '../utils/tenantScope';
import type { PrismaClientLike } from '../types/prisma';

export default function onboardingRoutes(prisma: PrismaClientLike) {
  const router = Router();

  const requireUser = (req: AuthenticatedRequest, res: Response) => {
    const userId = requireAuthUserId(req, res);
    if (!userId) {
      return null;
    }
    return userId;
  };

  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
      const dto = await getOnboardingState(userId, prisma);
      return res.json(dto);
    } catch (error) {
      console.error('[ONBOARDING] Failed to fetch state:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno ao carregar onboarding.' });
    }
  });

  router.patch('/', validate({ body: onboardingPatchSchema }), async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
      const dto = await patchOnboarding(userId, req.body, prisma);
      return res.json(dto);
    } catch (error) {
      console.error('[ONBOARDING] Failed to save step:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao salvar onboarding.' });
    }
  });

  router.post('/skip', async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
      const dto = await dismissOnboarding(userId, prisma);
      return res.json(dto);
    } catch (error) {
      console.error('[ONBOARDING] Failed to skip onboarding:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao pular onboarding.' });
    }
  });

  router.post('/complete', async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;

    try {
      const dto = await completeOnboarding(userId, prisma);
      return res.json(dto);
    } catch (error) {
      console.error('[ONBOARDING] Failed to complete onboarding:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao concluir onboarding.' });
    }
  });

  return router;
}
