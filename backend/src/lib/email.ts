import { Resend } from 'resend';
import { config } from '../config';
import { logEvent, maskEmail } from './logger';

export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

type EmailSendOptions = {
  correlationId?: string;
  jobId?: string;
  type?: string;
  userId?: string;
};

const assertResendConfigured = () => {
  if (config.emailProvider !== 'resend') return;
  if (!config.resendApiKey) {
    throw new Error('RESEND_API_KEY is required when AUTH_EMAIL_PROVIDER=resend');
  }
};

const resolveFrom = (payloadFrom?: string): string => {
  const resolvedFrom = payloadFrom || config.authEmailFrom || config.resendFrom;
  if (resolvedFrom) return resolvedFrom;

  const guidance = 'Missing sender: set AUTH_EMAIL_FROM or RESEND_FROM (domain must be verified in Resend).';
  if (config.nodeEnv === 'production') {
    throw new Error(guidance);
  }

  console.warn(`[Email] ${guidance} Falling back to dev sender <dev@localhost>.`);
  return 'dev@localhost';
};

const getResendClient = (() => {
  let client: Resend | null = null;
  return () => {
    if (client) return client;
    assertResendConfigured();
    client = new Resend(config.resendApiKey);
    return client;
  };
})();

export async function sendEmail(payload: EmailPayload, options: EmailSendOptions = {}) {
  const provider = config.emailProvider || 'noop';
  const from = resolveFrom(payload.from);
  const baseMeta = {
    to: maskEmail(payload.to),
    subject: payload.subject,
    provider,
    jobId: options.jobId,
    type: options.type,
    userId: options.userId,
  };

  if (provider === 'noop') {
    logEvent({
      event: 'email.send.noop',
      correlationId: options.correlationId,
      meta: baseMeta,
    });
    return { id: `noop-${Date.now()}`, provider, ...payload, from };
  }

  if (provider !== 'resend') {
    throw new Error(`Unsupported email provider: ${provider}`);
  }

  const resend = getResendClient();
  try {
    type ResendSendPayload = Parameters<typeof resend.emails.send>[0];

    const resendPayload: ResendSendPayload = payload.html
      ? {
          from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          ...(payload.text ? { text: payload.text } : {}),
        }
      : payload.text
        ? {
            from,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
          }
        : (() => {
            throw new Error('Email payload must include html or text content');
          })();

    const response = await resend.emails.send(resendPayload);

    if ('error' in response && response.error) {
      throw new Error(response.error.message);
    }

    const messageId = ('data' in response ? response.data?.id : undefined) || (response as any).id || `resend-${Date.now()}`;

    logEvent({
      event: 'email.send.success',
      correlationId: options.correlationId ?? messageId,
      meta: { ...baseMeta, messageId },
    });

    return { id: messageId, provider, ...payload, from };
  } catch (error) {
    logEvent({
      event: 'email.send.failed',
      level: 'error',
      correlationId: options.correlationId,
      meta: {
        ...baseMeta,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
