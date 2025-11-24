import amqp from 'amqplib';
import { sendEmail } from '../lib/email';
import { EMAIL_VERIFICATION_QUEUE } from '../services/emailVerification';

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

export type VerifyEmailJob = {
  type: 'VERIFY_EMAIL';
  email: string;
  verificationUrl: string;
  userId: string;
  expiresAt: string;
};

const handleVerifyEmail = async (payload: VerifyEmailJob) => {
  const text = `Confirme seu acesso ao Finfy: ${payload.verificationUrl}\nEste link expira em ${payload.expiresAt}.`;
  await sendEmail({
    to: payload.email,
    subject: 'Confirme seu e-mail no Finfy',
    text,
    html: `<p>Olá!</p><p>Confirme seu acesso clicando no link abaixo:</p><p><a href="${payload.verificationUrl}">Verificar e-mail</a></p><p>O link expira em ${new Date(payload.expiresAt).toLocaleString()}.</p>`
  });
};

const handleMessage = async (msg: amqp.ConsumeMessage | null, channel: amqp.ConfirmChannel) => {
  if (!msg) return;
  try {
    const payload = JSON.parse(msg.content.toString()) as VerifyEmailJob;
    if (payload.type === 'VERIFY_EMAIL') {
      await handleVerifyEmail(payload);
    }
    channel.ack(msg);
  } catch (error) {
    console.error('[EmailWorker] failed to process message', error);
    channel.nack(msg, false, false);
  }
};

const bootstrap = async () => {
  const connection = await amqp.connect(RABBIT_URL);
  const channel = await connection.createConfirmChannel();
  await channel.assertQueue(EMAIL_VERIFICATION_QUEUE, { durable: true });
  await channel.prefetch(5);
  console.log('[EmailWorker] waiting for email jobs...');
  await channel.consume(EMAIL_VERIFICATION_QUEUE, (msg) => handleMessage(msg, channel));
};

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((error) => {
    console.error('[EmailWorker] fatal error', error);
    process.exit(1);
  });
}
