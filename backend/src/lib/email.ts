import { config } from '../config';

import { config } from '../config';

export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export async function sendEmail(payload: EmailPayload) {
  // Placeholder for transactional provider integration (e.g., Resend)
  // In test environments this is mocked; in development we log for visibility.
  const provider = config.emailProvider || 'noop';

  if (provider === 'noop') {
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Email] Noop provider - email not sent', { to: payload.to, subject: payload.subject });
    }
    return { id: `noop-${Date.now()}`, provider, ...payload };
  }

  if (process.env.NODE_ENV !== 'test') {
    console.info('[Email] Sending email', { to: payload.to, subject: payload.subject, provider });
  }
  return { id: `${provider}-${Date.now()}`, provider, ...payload };
}
