import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 4000;
      const parsed = Number(val);
      if (Number.isNaN(parsed)) {
        throw new Error('PORT must be a valid number');
      }
      return parsed;
    }),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  RABBIT_URL: z.string().min(1).default('amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm'),
  CORS_ORIGINS: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration.');
}

const corsOrigins =
  parsedEnv.data.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

export const config = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  rabbitUrl: parsedEnv.data.RABBIT_URL,
  corsOrigins,
};

export const isCorsAllowed = (origin?: string): boolean => {
  if (!origin || corsOrigins.length === 0 || corsOrigins.includes('*')) {
    return true;
  }
  return corsOrigins.includes(origin);
};
