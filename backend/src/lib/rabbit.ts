import amqp from 'amqplib';

const RABBIT_URL =
  process.env.RABBIT_URL || 'amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm';

let channel: amqp.Channel | null = null;

export async function connectRabbit() {
  if (channel) return channel;
  const conn = await amqp.connect(RABBIT_URL);
  channel = await conn.createChannel();
  await channel.assertQueue('recurring-jobs', { durable: true });
  console.log('[Rabbit] Connected and queue ready');
  return channel;
}

export async function publishRecurringJob(userId?: string) {
  const ch = await connectRabbit();
  const msg = JSON.stringify({ type: 'recurring.process', userId, ts: Date.now() });
  ch.sendToQueue('recurring-jobs', Buffer.from(msg), { persistent: true });
  console.log('[Rabbit] Job queued:', msg);
}
