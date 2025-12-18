import { config } from '../src/config';
import { publishEmailJob } from '../src/lib/rabbit';
import { EMAIL_VERIFICATION_QUEUE } from '../src/lib/queues';
import { logEvent } from '../src/lib/logger';

const resolveVerificationUrl = (token: string) => {
  const base = config.emailVerificationBaseUrl.replace(/\/$/, '');
  return `${base}/auth/verify-email?token=${token}`;
};

const main = async () => {
  const recipient = process.env.SMOKE_EMAIL ?? 'dev@localhost';
  const token = process.env.SMOKE_TOKEN ?? 'smoke-token';
  const userId = process.env.SMOKE_USER_ID ?? 'smoke-user';
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const payload = {
    type: 'VERIFY_EMAIL' as const,
    email: recipient,
    verificationUrl: resolveVerificationUrl(token),
    userId,
    expiresAt,
  };

  await publishEmailJob(payload, process.env.SMOKE_JOB_ID);
  logEvent({
    event: 'email.verify-email.smoke-enqueued',
    meta: {
      queue: EMAIL_VERIFICATION_QUEUE,
      userId,
      email: recipient,
      expiresAt,
    },
  });
};

main()
  .then(() => {
    console.info(`[Smoke] Job enviado para ${EMAIL_VERIFICATION_QUEUE}. Aguarde o email-worker processar.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Smoke] Falha ao enfileirar job de verificação:', error);
    process.exit(1);
  });
