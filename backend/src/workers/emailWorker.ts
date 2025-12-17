import { ConsumeMessage } from 'amqplib';
import { z } from 'zod';
import { config } from '../config';
import { sendEmail } from '../lib/email';
import { createRabbit } from '../lib/rabbit';
import { EMAIL_VERIFICATION_QUEUE } from '../lib/queues';
import { logEvent } from '../lib/logger';
import crypto from 'crypto';

export const verifyEmailJobSchema = z.object({
  type: z.literal('VERIFY_EMAIL'),
  email: z.string().email(),
  verificationUrl: z.string().url(),
  userId: z.string(),
  expiresAt: z.string(),
});

export type VerifyEmailJob = z.infer<typeof verifyEmailJobSchema>;

type EmailJobContext = {
  correlationId?: string;
  jobId?: string;
  attempt?: number;
};

type EmailJobResult =
  | { ack: true; handled: true; retryable?: boolean }
  | { ack: true; handled: false; retryable?: boolean }
  | { ack: false; handled: true; retryable?: boolean; error?: string };

const logEmailEvent = (
  event: string,
  meta: Record<string, unknown> = {},
  level: 'info' | 'warn' | 'error' = 'info',
  correlationId?: string,
) => {
  logEvent({ event, level, meta, correlationId });
};

export const handleVerifyEmailJob = async (payload: VerifyEmailJob, context?: EmailJobContext) => {
  const { email, verificationUrl, expiresAt, userId } = payload;
  const expiration = new Date(expiresAt);
  const expiresHuman = expiration.toLocaleString();
  const text = [
    'Olá!',
    'Confirme seu acesso clicando no link abaixo:',
    verificationUrl,
    `O link expira em ${expiresHuman}.`,
    'Se você não solicitou, ignore este e-mail.',
  ].join('\n');
  const html = `
    <p>Olá!</p>
    <p>Confirme seu acesso clicando no link abaixo:</p>
    <p><a href="${verificationUrl}">Verificar e-mail</a></p>
    <p>O link expira em ${expiresHuman}.</p>
    <p>Se você não solicitou, ignore este e-mail.</p>
  `;

  const result = await sendEmail({
    to: email,
    subject: 'Confirme seu e-mail no Finfy',
    text,
    html,
  }, {
    correlationId: context?.correlationId,
    jobId: context?.jobId,
    type: payload.type,
    userId,
  });

  logEmailEvent('email.verify-email.sent', {
    userId,
    messageId: (result as any).id,
    provider: (result as any).provider ?? config.emailProvider,
    correlationId: context?.correlationId,
  }, 'info', context?.correlationId);
};

export const handleEmailJob = async (payload: unknown, context?: EmailJobContext): Promise<EmailJobResult> => {
  const parsed = verifyEmailJobSchema.safeParse(payload);
  if (!parsed.success) {
    logEmailEvent('email.verify-email.invalid-payload', { reason: parsed.error.flatten().formErrors }, 'warn', context?.correlationId);
    return { ack: true as const, handled: false, retryable: false };
  }

  logEmailEvent('email.verify-email.received', {
    userId: parsed.data.userId,
    email: parsed.data.email,
    expiresAt: parsed.data.expiresAt,
    correlationId: context?.correlationId,
    attempt: context?.attempt,
  }, 'info', context?.correlationId);

  try {
    await handleVerifyEmailJob(parsed.data, context);
    return { ack: true as const, handled: true, retryable: false };
  } catch (error) {
    logEmailEvent(
      'email.verify-email.failed',
      {
        userId: parsed.data.userId,
        error: error instanceof Error ? error.message : String(error),
        retryable: true,
        correlationId: context?.correlationId,
        attempt: context?.attempt,
      },
      'error',
      context?.correlationId,
    );
    return { ack: false as const, handled: true, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
};

const resolveAttempt = (msg: ConsumeMessage) => {
  const retryHeader = Number(msg.properties.headers?.['x-retry-count'] ?? 0);
  const xDeath = msg.properties.headers?.['x-death'];
  const xDeathCount = Array.isArray(xDeath) ? Number(xDeath[0]?.count ?? 0) : 0;
  const attempt = Number.isFinite(retryHeader) ? retryHeader : 0;
  return Math.max(attempt, xDeathCount);
};

const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;

export const startEmailWorker = async () => {
  const { channel } = await createRabbit({ queue: EMAIL_VERIFICATION_QUEUE, prefetch: 5 });
  await channel.consume(EMAIL_VERIFICATION_QUEUE, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId ?? msg.properties.messageId ?? crypto.randomUUID();
      const attempt = resolveAttempt(msg);
      const result = await handleEmailJob(payload, { correlationId, jobId: msg.properties.messageId, attempt });
      if (result.ack) {
        channel.ack(msg);
        return;
      }

      const nextAttempt = attempt + 1;
      if (!result.retryable || nextAttempt > MAX_RETRY_ATTEMPTS) {
        channel.nack(msg, false, false);
        logEmailEvent('email.verify-email.dlq', {
          correlationId,
          attempt: nextAttempt,
          reason: result.retryable ? 'max_attempts' : 'non_retryable',
        }, 'error', correlationId);
        return;
      }

      const delay = Math.min(BASE_RETRY_DELAY_MS * nextAttempt, 10_000);
      logEmailEvent('email.verify-email.requeue', { correlationId, attempt: nextAttempt, delayMs: delay }, 'warn', correlationId);
      setTimeout(() => {
        channel.sendToQueue(EMAIL_VERIFICATION_QUEUE, msg.content, {
          ...msg.properties,
          headers: {
            ...(msg.properties.headers ?? {}),
            'x-retry-count': nextAttempt,
            'x-last-error': result.error,
          },
          timestamp: Date.now(),
        });
        channel.ack(msg);
      }, delay);
    } catch (error) {
      logEmailEvent('email.verify-email.unexpected', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error', msg?.properties?.correlationId ?? msg?.properties?.messageId);
      channel.nack(msg, false, false);
    }
  });

  logEmailEvent('email.worker.ready', { queue: EMAIL_VERIFICATION_QUEUE, rabbitUrl: config.rabbitUrl });
};

if (process.env.NODE_ENV !== 'test') {
  startEmailWorker().catch((error) => {
    logEmailEvent('email.worker.fatal', { error: error instanceof Error ? error.message : String(error) }, 'error');
    process.exit(1);
  });
}
