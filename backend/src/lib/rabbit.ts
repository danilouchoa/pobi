import { connect, type ConfirmChannel, type Connection } from 'amqplib';
import crypto from 'crypto';

const RABBIT_URL =
  process.env.RABBIT_URL || 'amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm';

type RabbitContext = {
  connection: Connection;
  channel: ConfirmChannel;
};

let sharedConnection: Connection | null = null;
let sharedChannel: ConfirmChannel | null = null;
const consumerContexts = new Map<string, RabbitContext>();

const formatError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const logConnected = () => {
  console.log('[Rabbit] Connected and queue ready');
};

const attachConnectionHandlers = (
  connection: Connection,
  onClose: () => void
) => {
  connection.on('error', (error: unknown) => {
    console.error('[Rabbit] connection error', formatError(error));
  });
  connection.on('close', () => {
    console.warn('[Rabbit] connection closed');
    onClose();
  });
};

const attachChannelHandlers = (
  channel: ConfirmChannel,
  onClose: () => void
) => {
  channel.on('error', (error: unknown) => {
    console.error('[Rabbit] channel error', formatError(error));
  });
  channel.on('close', () => {
    console.warn('[Rabbit] channel closed');
    onClose();
  });
};

const ensureSharedConnection = async (): Promise<Connection> => {
  if (sharedConnection) return sharedConnection;
  sharedConnection = await connect(RABBIT_URL);
  attachConnectionHandlers(sharedConnection, () => {
    sharedConnection = null;
    sharedChannel = null;
  });
  return sharedConnection;
};

const ensureSharedChannel = async (): Promise<ConfirmChannel> => {
  if (sharedChannel) return sharedChannel;
  const connection = await ensureSharedConnection();
  sharedChannel = await connection.createConfirmChannel();
  attachChannelHandlers(sharedChannel, () => {
    sharedChannel = null;
  });
  await sharedChannel.assertQueue('recurring-jobs', { durable: true });
  await sharedChannel.assertQueue('bulkUpdateQueue', { durable: true });
  logConnected();
  return sharedChannel;
};

async function openContext(options: {
  queue: string;
  prefetch?: number;
}): Promise<RabbitContext> {
  const connection = await connect(RABBIT_URL);
  attachConnectionHandlers(connection, () => {
    consumerContexts.delete(options.queue);
  });
  const channel = await connection.createConfirmChannel();
  attachChannelHandlers(channel, () => {
    consumerContexts.delete(options.queue);
  });
  const prefetch = options.prefetch ?? 10;
  if (prefetch > 0) {
    await channel.prefetch(prefetch);
  }
  await channel.assertQueue(options.queue, { durable: true });
  logConnected();
  return { connection, channel };
}

export async function createRabbit({
  queue,
  prefetch,
}: {
  queue: string;
  prefetch?: number;
}): Promise<RabbitContext> {
  const cached = consumerContexts.get(queue);
  if (cached) return cached;
  const context = await openContext({ queue, prefetch });
  consumerContexts.set(queue, context);
  return context;
}

const resolveJobId = (payload: unknown, jobId?: string) => {
  if (jobId) return jobId;
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'jobId' in (payload as Record<string, unknown>)
  ) {
    const extracted = (payload as Record<string, unknown>).jobId;
    if (typeof extracted === 'string') {
      return extracted;
    }
  }
  return crypto.randomUUID();
};

export async function publishToQueue(
  queue: string,
  payload: unknown,
  jobId?: string
) {
  const channel = await ensureSharedChannel();
  const correlationId = resolveJobId(payload, jobId);
  const body = Buffer.from(JSON.stringify(payload));

  await new Promise<void>((resolve, reject) => {
    channel.sendToQueue(
      queue,
      body,
      {
        persistent: true,
        contentType: 'application/json',
        correlationId,
        messageId: correlationId,
      },
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
  await channel.waitForConfirms();
  console.log(`[Rabbit] Job queued: ${queue} id=${correlationId}`);
}

export async function publishRecurringJob(userId?: string) {
  await publishToQueue('recurring-jobs', { type: 'recurring.process', userId, ts: Date.now() });
}

type BulkUpdateMessage = {
  jobId: string;
  payload: unknown;
};

export async function publishBulkUpdateJob(message: BulkUpdateMessage) {
  await publishToQueue('bulkUpdateQueue', message.payload ?? message, message.jobId);
}
