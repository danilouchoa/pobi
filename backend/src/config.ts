import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SECURITY_MODE: z.enum(['strict', 'relaxed']).optional(),
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
  AUTH_GOOGLE_ENABLED: z.enum(['true', 'false']).optional()
    .transform(val => val !== 'false')
    .default('true' as any),
  AUTH_ACCOUNT_LINK_ENABLED: z.enum(['true', 'false']).optional()
    .transform(val => val !== 'false')
    .default('true' as any),
  AUTH_EMAIL_VERIFICATION_REQUIRED: z.enum(['true', 'false']).optional()
    .transform(val => val !== 'false')
    .default('true' as any),
  AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.string().optional(),
  AUTH_EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS: z.string().optional(),
  AUTH_EMAIL_VERIFICATION_ENQUEUE_ENABLED: z.enum(['true', 'false']).optional(),
  AUTH_EMAIL_PROVIDER: z.string().optional(),
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = Number(val ?? '24');
      return Number.isNaN(parsed) ? 24 : parsed;
    }),
  EMAIL_VERIFICATION_RESEND_MINUTES: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = Number(val ?? '10');
      return Number.isNaN(parsed) ? 10 : parsed;
    }),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration.');
}

const resolvedSecurityMode =
  parsedEnv.data.SECURITY_MODE ?? (parsedEnv.data.NODE_ENV === 'production' ? 'strict' : 'relaxed');

if (parsedEnv.data.NODE_ENV === 'production' && resolvedSecurityMode === 'relaxed') {
  console.warn('⚠️ SECURITY_MODE=relaxed em produção. Habilite apenas se entender os riscos.');
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

const tokenTtlMinutes = (() => {
  if (parsedEnv.data.AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES) {
    const parsed = Number(parsedEnv.data.AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES);
    return Number.isNaN(parsed) ? 24 * 60 : parsed;
  }
  const hours = parsedEnv.data.EMAIL_VERIFICATION_TOKEN_TTL_HOURS ?? 24;
  return hours * 60;
})();

const resendWindowSeconds = (() => {
  if (parsedEnv.data.AUTH_EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS) {
    const parsed = Number(parsedEnv.data.AUTH_EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS);
    return Number.isNaN(parsed) ? 10 * 60 : parsed;
  }
  const minutes = parsedEnv.data.EMAIL_VERIFICATION_RESEND_MINUTES ?? 10;
  return minutes * 60;
})();

const emailVerificationRequired = (() => {
  if (parsedEnv.data.AUTH_EMAIL_VERIFICATION_REQUIRED !== undefined) {
    return parsedEnv.data.AUTH_EMAIL_VERIFICATION_REQUIRED;
  }
  return true;
})();

const emailVerificationEnqueueEnabled = (() => {
  if (parsedEnv.data.AUTH_EMAIL_VERIFICATION_ENQUEUE_ENABLED !== undefined) {
    return parsedEnv.data.AUTH_EMAIL_VERIFICATION_ENQUEUE_ENABLED !== 'false';
  }
  return parsedEnv.data.NODE_ENV !== 'test';
})();

const emailProvider = parsedEnv.data.AUTH_EMAIL_PROVIDER
  ?? (parsedEnv.data.NODE_ENV === 'production' ? 'resend' : 'noop');

export const config = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  rabbitUrl: parsedEnv.data.RABBIT_URL,
  corsOrigins: derivedCorsOrigins,
  securityMode: resolvedSecurityMode,
  validationEnabled: parsedEnv.data.VALIDATION_ENABLED,
  frontendOrigin: parsedEnv.data.FRONTEND_ORIGIN,
  cookieDomain: parsedEnv.data.COOKIE_DOMAIN,
  googleClientId: parsedEnv.data.GOOGLE_CLIENT_ID,
  googleClientSecret: parsedEnv.data.GOOGLE_CLIENT_SECRET,
  authGoogleEnabled: parsedEnv.data.AUTH_GOOGLE_ENABLED,
  authAccountLinkEnabled: parsedEnv.data.AUTH_ACCOUNT_LINK_ENABLED,
  emailVerificationTokenTtlMinutes: tokenTtlMinutes,
  emailVerificationResendWindowSeconds: resendWindowSeconds,
  emailVerificationRequired,
  emailVerificationEnqueueEnabled,
  emailProvider,
};

export const isCorsAllowed = (origin?: string): boolean => {
  if (config.securityMode === 'relaxed') {
    return true;
  }
  if (!origin || derivedCorsOrigins.length === 0 || derivedCorsOrigins.includes('*')) {
    return true;
  }
  return derivedCorsOrigins.includes(origin);
};
