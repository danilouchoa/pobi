import { Request, Response, NextFunction } from 'express';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'apiKey',
];

const isObject = (val: unknown): val is Record<string, unknown> => (
  val !== null && typeof val === 'object' && !Array.isArray(val)
);

const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 2) return '[deep-object]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => {
        if (SENSITIVE_KEYS.includes(key)) return [key, '[redacted]'];
        return [key, redact(val, depth + 1)];
      }),
    );
  }
  if (typeof value === 'string' && value.length > 120) {
    return `${value.slice(0, 117)}...`;
  }
  return value;
};

const serializePayload = (req: Request) => {
  const payload = {
    query: Object.keys(req.query || {}).length ? redact(req.query) : undefined,
    body: Object.keys((req.body as Record<string, unknown>) || {}).length ? redact(req.body) : undefined,
  };

  const json = JSON.stringify(payload);
  // Evita logs gigantes e mantém visibilidade mínima
  return json.length > 800 ? `${json.slice(0, 797)}...` : json;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const payload = serializePayload(req);
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms) payload=${payload}`;
    console.log(log);
  });
  next();
};
