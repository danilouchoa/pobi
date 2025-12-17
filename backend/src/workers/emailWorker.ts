import { ConsumeMessage } from 'amqplib';
import { z } from 'zod';
import { config } from '../config';
import { sendEmail } from '../lib/email';
import { createRabbit } from '../lib/rabbit';
import { EMAIL_VERIFICATION_QUEUE } from '../lib/queues';
import { logEvent } from '../lib/logger';

export const verifyEmailJobSchema = z.object({
  type: z.literal('VERIFY_EMAIL'),
  email: z.string().email(),
  verificationUrl: z.string().url(),
  userId: z.string(),
  expiresAt: z.string(),
});

export type VerifyEmailJob = z.infer<typeof verifyEmailJobSchema>;

const logEmailEvent = (event: string, meta: Record<string, unknown> = {}, level: 'info' | 'warn' | 'error' = 'info') => {
  logEvent({ event, level, meta });
};

export const handleVerifyEmailJob = async (payload: VerifyEmailJob) => {
  const { email, verificationUrl, expiresAt, userId } = payload;
  const expiration = new Date(expiresAt);
  const text = `Confirme seu acesso ao Finfy: ${verificationUrl}\nEste link expira em ${expiration.toISOString()}.`;

  const result = await sendEmail({
    to: email,
    subject: 'Confirme seu e-mail no Finfy',
    text,
    html: `<p>Olá!</p><p>Confirme seu acesso clicando no link abaixo:</p><p><a href="${verificationUrl}">Verificar e-mail</a></p><p>O link expira em ${expiration.toLocaleString()}.</p>`,
  });

  logEmailEvent('email.verify-email.sent', {
    userId,
    messageId: (result as any).id,
    provider: (result as any).provider ?? config.emailProvider,
  });
};

export const handleEmailJob = async (payload: unknown) => {
  const parsed = verifyEmailJobSchema.safeParse(payload);
  if (!parsed.success) {
    logEmailEvent('email.verify-email.invalid-payload', { reason: parsed.error.flatten().formErrors }, 'warn');
    return { ack: true as const, handled: false };
  }

  logEmailEvent('email.verify-email.received', {
    userId: parsed.data.userId,
    email: parsed.data.email,
    expiresAt: parsed.data.expiresAt,
  });

  try {
    await handleVerifyEmailJob(parsed.data);
    return { ack: true as const, handled: true };
  } catch (error) {
    logEmailEvent(
      'email.verify-email.failed',
      {
        userId: parsed.data.userId,
        error: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
      'error',
    );
    return { ack: false as const, handled: true };
  }
};

export const startEmailWorker = async () => {
  const { channel } = await createRabbit({ queue: EMAIL_VERIFICATION_QUEUE, prefetch: 5 });
  await channel.consume(EMAIL_VERIFICATION_QUEUE, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const result = await handleEmailJob(payload);
      if (result.ack) {
        channel.ack(msg);
      } else {
        channel.nack(msg, false, false);
      }
    } catch (error) {
      logEmailEvent('email.verify-email.unexpected', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
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
