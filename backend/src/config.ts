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
  // Sanitizado: nunca incluir credenciais reais em default
  RABBIT_URL: z.string().min(1).default('amqp://localhost'),
  CORS_ORIGINS: z.string().optional(),
  FRONTEND_ORIGIN: z
    .string({
      required_error: 'FRONTEND_ORIGIN is required',
    })
    .url('FRONTEND_ORIGIN must be a valid URL'),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((val) => val?.trim() || undefined),
  GOOGLE_CLIENT_ID: z
    .string({
      required_error: 'GOOGLE_CLIENT_ID is required',
    })
    .min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z
    .string({
      required_error: 'GOOGLE_CLIENT_SECRET is required',
    })
    .min(1, 'GOOGLE_CLIENT_SECRET is required'),
  /**
   * Feature Flag: Validação de Entrada (Milestone #11)
   * 
   * Controla se a validação Zod de entrada (body/query/params) está ativa.
   * 
   * Comportamento:
   * - true (default): Valida todas as requisições, retorna 400 para payloads inválidos
   * - false: Desativa validação (útil para rollback rápido em caso de falso positivo)
   * 
   * Quando desativar:
   * - Emergências: falso positivo bloqueando operação crítica
   * - Smoke tests: validar funcionalidade sem restrições
   * - Debug: isolar se problema é da validação ou da lógica de negócio
   * 
   * Riscos de desativar:
   * - Perde proteção contra payloads malformados
   * - Permite mass assignment attacks
   * - Reduz observabilidade de erros de input
   * 
   * Recomendação: manter ativado em produção, monitorar métricas de falhas
   */
  VALIDATION_ENABLED: z.enum(['true', 'false']).optional()
    .transform(val => val !== 'false') // true por default
    .default('true' as any),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration.');
}

const rawCorsOrigins =
  parsedEnv.data.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const derivedCorsOrigins = Array.from(
  new Set([
    ...rawCorsOrigins,
    parsedEnv.data.FRONTEND_ORIGIN,
  ].filter(Boolean)),
);

export const config = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  rabbitUrl: parsedEnv.data.RABBIT_URL,
  corsOrigins: derivedCorsOrigins,
  validationEnabled: parsedEnv.data.VALIDATION_ENABLED,
  frontendOrigin: parsedEnv.data.FRONTEND_ORIGIN,
  cookieDomain: parsedEnv.data.COOKIE_DOMAIN,
  googleClientId: parsedEnv.data.GOOGLE_CLIENT_ID,
  googleClientSecret: parsedEnv.data.GOOGLE_CLIENT_SECRET,
};

export const isCorsAllowed = (origin?: string): boolean => {
  if (!origin || derivedCorsOrigins.length === 0 || derivedCorsOrigins.includes('*')) {
    return true;
  }
  return derivedCorsOrigins.includes(origin);
};
