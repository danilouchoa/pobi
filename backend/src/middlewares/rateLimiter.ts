import rateLimit from 'express-rate-limit';
import type { Options } from 'express-rate-limit';
import type { Request } from 'express';

const defaultKeyGenerator = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

const createLimiter = (options: Partial<Options>) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: defaultKeyGenerator,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
    ...options,
  });

export const authLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
});

export const authSensitiveLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
});

export const adminLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
});

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
