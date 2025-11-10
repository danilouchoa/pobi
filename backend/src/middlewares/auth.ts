import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'Token não informado.' });
    }

    const [, token] = authHeader.split(' ');

    if (!token) {
      return res.status(401).json({ message: 'Token inválido.' });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET não definido. Configure no arquivo .env');
    }

    const payload = jwt.verify(token, secret) as { userId: string };
    req.userId = payload.userId;

    next();
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(401).json({ message: 'Não autorizado.' });
  }
};
