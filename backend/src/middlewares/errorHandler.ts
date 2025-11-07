import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

type JsonParseError = SyntaxError & { status?: number; statusCode?: number; type?: string };

export const invalidJsonHandler = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parseError = err as JsonParseError;
  if (
    parseError instanceof SyntaxError &&
    (parseError.status === 400 || parseError.statusCode === 400 || parseError.type === 'entity.parse.failed')
  ) {
    return res.status(400).json({ message: 'JSON inválido. Verifique o payload enviado.' });
  }

  return next(err);
};

export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error('Erro não tratado capturado pelo middleware global:', err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Registro duplicado.' });
    }
  }

  return res.status(500).json({ message: 'Erro interno do servidor.' });
};
