import { type NextFunction, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { PrismaClientLike } from '../types/prisma';
import { config } from '../config';
import { logEvent } from '../lib/logger';
import type { AuthenticatedRequest } from './auth';
import { getAuthUserId } from '../utils/tenantScope';

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

const buildForbiddenResponse = (res: Response, emailVerifiedAt?: Date | string | null) => {
  const emailVerifiedAtString: string | undefined = emailVerifiedAt
    ? typeof emailVerifiedAt === 'string'
      ? emailVerifiedAt
      : emailVerifiedAt.toISOString()
    : undefined;

  const payload: { error: string; message: string; reason: string; emailVerifiedAt?: string } = {
    error: 'EMAIL_NOT_VERIFIED',
    message: 'Seu e-mail ainda não foi confirmado. Confirme seu e-mail para usar esta funcionalidade.',
    reason: 'email_not_verified',
    emailVerifiedAt: emailVerifiedAtString,
  };

  return res.status(403).json(payload);
};

export const requireEmailVerified = (
  prisma: Pick<PrismaClient, 'user'> | Pick<PrismaClientLike, 'user'>
): RequestHandler =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!config.emailVerificationRequired) {
      const userId = getAuthUserId(req);
      logEvent({
        event: 'auth.verify-email.gate.skipped',
        requestId: req.headers['x-request-id'] as string | undefined,
        userId: userId ?? undefined,
        ip: req.ip,
        meta: { reason: 'verification_disabled' },
      });
      return next();
    }

    const userId = getAuthUserId(req);

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

      const emailVerifiedAtString = user.emailVerifiedAt
        ? user.emailVerifiedAt instanceof Date
          ? user.emailVerifiedAt.toISOString()
          : user.emailVerifiedAt
        : undefined;

      if (!isEmailVerified(user)) {
        logEvent({
          event: 'auth.verify-email.blocked',
          requestId: req.headers['x-request-id'] as string | undefined,
          userId,
          ip: req.ip,
          meta: { emailVerifiedAt: emailVerifiedAtString ?? undefined },
        });
        return buildForbiddenResponse(res, emailVerifiedAtString ?? undefined);
      }

      return next();
    } catch (error) {
      console.error('[EMAIL_VERIFIED_MIDDLEWARE] Erro ao consultar verificação de e-mail:', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno no servidor.' });
    }
  };

export type { VerificationLikeUser };
