import type { Response, Request } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth';

export const getAuthUserId = (req: AuthenticatedRequest | Request): string | null => {
  const scoped = req as AuthenticatedRequest;
  if (scoped.auth?.userId) {
    return scoped.auth.userId;
  }
  if (scoped.userId) {
    return scoped.userId;
  }
  return null;
};

export const requireAuthUserId = (req: AuthenticatedRequest | Request, res: Response): string | null => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'Não autorizado.' });
    return null;
  }
  return userId;
};

export const tenantWhere = (userId: string) => ({ userId });

export const notFound = (res: Response) => res.status(404).json({ message: 'Não encontrado.' });
