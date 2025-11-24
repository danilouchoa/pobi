export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export async function sendEmail(payload: EmailPayload) {
  // Placeholder for transactional provider integration (e.g., Resend)
  // In test environments this is mocked; in development we log for visibility.
  if (process.env.NODE_ENV !== 'test') {
    console.info('[Email] Sending email', { to: payload.to, subject: payload.subject });
  }
  return { id: `mock-${Date.now()}`, ...payload };
}
