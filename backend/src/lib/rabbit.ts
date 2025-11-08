import amqp from 'amqplib';

const RABBIT_URL =
  process.env.RABBIT_URL || 'amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm';

type ConfirmConnection = amqp.Connection & {
  createConfirmChannel: () => Promise<amqp.ConfirmChannel>;
};

let connection: ConfirmConnection | undefined;
let channel: amqp.ConfirmChannel | undefined;

async function createChannel(): Promise<amqp.ConfirmChannel> {
  connection = (await amqp.connect(RABBIT_URL)) as unknown as ConfirmConnection;
  connection.on('close', () => {
    console.warn('[Rabbit] Connection closed. Will recreate channel on next publish.');
    connection = undefined;
    channel = undefined;
  });
  connection.on('error', (err) => {
    console.error('[Rabbit] Connection error:', err);
  });
  const confirmChannel = (await connection.createConfirmChannel()) as unknown as amqp.ConfirmChannel;
  await confirmChannel.assertQueue('recurring-jobs', { durable: true });
  console.log('[Rabbit] Connected and queue ready');
  return confirmChannel;
}

export async function connectRabbit(): Promise<amqp.ConfirmChannel> {
  if (channel) return channel;
  channel = await createChannel();
  return channel!;
}

const sendWithConfirm = (
  ch: amqp.ConfirmChannel,
  queue: string,
  content: Buffer,
  options?: amqp.Options.Publish
) =>
  new Promise<void>((resolve, reject) => {
    ch.sendToQueue(queue, content, { persistent: true, ...(options || {}) }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

export async function publishRecurringJob(userId?: string) {
  const ch = await connectRabbit();
  const msg = JSON.stringify({ type: 'recurring.process', userId, ts: Date.now() });
  try {
    await sendWithConfirm(ch, 'recurring-jobs', Buffer.from(msg));
    console.log('[Rabbit] Job queued:', msg);
  } catch (error) {
    console.error('[Rabbit] Failed to queue job:', error);
    throw error;
  }
}
