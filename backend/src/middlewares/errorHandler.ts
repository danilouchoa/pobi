import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type JsonParseError = SyntaxError & { status?: number; statusCode?: number; type?: string };
type CsrfError = Error & { code?: string };

export const invalidJsonHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parseError = err as JsonParseError;
  if (
    parseError instanceof SyntaxError &&
    (parseError.status === 400 || parseError.statusCode === 400 || parseError.type === 'entity.parse.failed')
  ) {
    return res.status(400).json({ error: 'JSON inválido. Verifique o payload enviado.' });
  }

  return next(err);
};

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const csrfError = err as CsrfError;
  if (csrfError?.code === 'EBADCSRFTOKEN') {
    console.warn('[SECURITY] CSRF token mismatch');
    return res.status(403).json({ error: 'INVALID_CSRF_TOKEN', message: 'Token CSRF inválido ou ausente.' });
  }

  if (err instanceof Error && err.message === 'Origin not allowed by CORS') {
    console.warn('[SECURITY] CORS blocked request');
    return res.status(403).json({ error: 'CORS_NOT_ALLOWED', message: 'Origem não autorizada.' });
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Registro duplicado.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    console.error('Erro Prisma não tratado:', err);
    return res.status(400).json({ error: 'Falha na operação com o banco de dados.' });
  }

  if (err instanceof Error) {
    console.error('Erro não tratado capturado pelo middleware global:', err.stack ?? err.message);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }

  console.error('Erro desconhecido capturado pelo middleware global:', err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
};
