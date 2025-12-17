import { type NextFunction, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logEvent } from '../lib/logger';
import type { AuthenticatedRequest } from './auth';

type VerificationLikeUser = {
  id: string;
  emailVerifiedAt?: Date | string | null;
  emailVerified?: boolean | null;
};

const isEmailVerified = (user?: VerificationLikeUser | null) => {
  if (!user) return false;
  if (user.emailVerifiedAt) return true;
  if (typeof user.emailVerified === 'boolean') return user.emailVerified;
  return false;
};

const buildForbiddenResponse = (res: Response, emailVerifiedAt: Date | string | null = null) =>
  res.status(403).json({
    error: 'EMAIL_NOT_VERIFIED',
    message: 'Seu e-mail ainda não foi confirmado. Confirme seu e-mail para usar esta funcionalidade.',
    reason: 'email_not_verified',
    emailVerifiedAt,
  });

export const requireEmailVerified = (prisma: Pick<PrismaClient, 'user'>): RequestHandler =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!config.emailVerificationRequired) {
      logEvent({
        event: 'auth.verify-email.gate.skipped',
        requestId: req.headers['x-request-id'] as string | undefined,
        userId: req.auth?.userId || req.userId,
        ip: req.ip,
        meta: { reason: 'verification_disabled' },
      });
      return next();
    }

    const userId = req.auth?.userId || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autorizado.' });
    }

    const cachedUser = (req as AuthenticatedRequest & { user?: VerificationLikeUser }).user;
    if (isEmailVerified(cachedUser)) {
      return next();
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, emailVerifiedAt: true },
      });

      if (!user || !user.id) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autorizado.' });
      }

      if (!isEmailVerified(user)) {
        logEvent({
          event: 'auth.verify-email.blocked',
          requestId: req.headers['x-request-id'] as string | undefined,
          userId,
          ip: req.ip,
          meta: { emailVerifiedAt: user.emailVerifiedAt ?? null },
        });
        return buildForbiddenResponse(res, user.emailVerifiedAt ?? null);
      }

      return next();
    } catch (error) {
      console.error('[EMAIL_VERIFIED_MIDDLEWARE] Erro ao consultar verificação de e-mail:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
    }
  };

export type { VerificationLikeUser };
