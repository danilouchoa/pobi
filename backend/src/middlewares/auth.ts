import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Provider } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    email?: string;
    provider?: string;
    googleLinked?: boolean;
  };
  userId?: string; // legado: mantido para compatibilidade com handlers antigos
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'Token não informado.' });
    }

    const [, token] = authHeader.split(' ');

    if (!token) {
      return res.status(401).json({ message: 'Token inválido.' });
    }

    const secret = process.env.JWT_SECRET || 'test-secret-key';

    const payload = jwt.verify(token, secret) as JwtPayload & {
      sub?: string;
      userId?: string;
      tokenType?: string;
      provider?: Provider | string;
      email?: string;
      googleLinked?: boolean;
    };
    const tokenType = payload.tokenType || (payload as any).type;
    if (tokenType && tokenType !== 'access') {
      return res.status(401).json({ message: 'Token inválido.' });
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : payload.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Token inválido.' });
    }

    req.auth = {
      userId,
      email: payload.email,
      provider: (payload.provider as string | undefined) ?? undefined,
      googleLinked: typeof payload.googleLinked === 'boolean' ? payload.googleLinked : undefined,
    };
    req.userId = userId;

    next();
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(401).json({ message: 'Não autorizado.' });
  }
};
