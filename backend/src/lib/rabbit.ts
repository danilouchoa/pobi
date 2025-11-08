import { connect, type ConfirmChannel, type Connection } from 'amqplib';

const RABBIT_URL =
  process.env.RABBIT_URL || 'amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm';

type RabbitContext = {
  connection: Connection;
  channel: ConfirmChannel;
};

let publisherContext: RabbitContext | null = null;
const consumerContexts = new Map<string, RabbitContext>();

const logConnected = () => {
  console.log('[Rabbit] Connected and queue ready');
};

const formatError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const attachConnectionHandlers = (connection: Connection, onClose: () => void) => {
  connection.on('error', (error: unknown) => {
    console.error('[Rabbit] connection error', formatError(error));
  });
  connection.on('close', () => {
    console.warn('[Rabbit] connection closed');
    onClose();
  });
};

async function openContext(options: {
  queue?: string;
  prefetch?: number;
  onClose: () => void;
}): Promise<RabbitContext> {
  const connection = await connect(RABBIT_URL);
  attachConnectionHandlers(connection, options.onClose);

  const channel = await connection.createConfirmChannel();
  const prefetch = options.prefetch ?? 0;
  if (prefetch > 0) {
    await channel.prefetch(prefetch);
  }
  if (options.queue) {
    await channel.assertQueue(options.queue, { durable: true });
  }
  logConnected();

  return { connection, channel };
}

const ensurePublisher = async (): Promise<RabbitContext> => {
  if (publisherContext) {
    return publisherContext;
  }
  publisherContext = await openContext({
    onClose: () => {
      publisherContext = null;
    },
  });
  await publisherContext.channel.assertQueue('recurring-jobs', { durable: true });
  await publisherContext.channel.assertQueue('bulk-jobs', { durable: true });
  return publisherContext;
};

export async function createRabbit({
  queue,
  prefetch,
}: {
  queue: string;
  prefetch?: number;
}): Promise<RabbitContext> {
  const cached = consumerContexts.get(queue);
  if (cached) {
    return cached;
  }

  const context = await openContext({
    queue,
    prefetch,
    onClose: () => consumerContexts.delete(queue),
  });
  consumerContexts.set(queue, context);
  return context;
}

export async function publishToQueue(queue: string, payload: unknown) {
  let context: RabbitContext | null = null;
  let usingShared = true;

  try {
    context = await ensurePublisher();
  } catch (error) {
    console.error('[Rabbit] connection error', formatError(error));
    usingShared = false;
    context = await openContext({
      queue,
      onClose: () => undefined,
    });
  }

  const { channel, connection } = context;
  const body = Buffer.from(JSON.stringify(payload));
  await new Promise<void>((resolve, reject) => {
    channel.sendToQueue(queue, body, { persistent: true }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
  await channel.waitForConfirms();
  console.log('[Rabbit] Job queued:', queue);

  if (!usingShared) {
    try {
      await channel.close();
    } catch (error) {
      console.error('[Rabbit] connection error', formatError(error));
    }
    try {
      await connection.close();
    } catch (error) {
      console.error('[Rabbit] connection error', formatError(error));
    }
  }
}

export async function publishRecurringJob(userId?: string) {
  await publishToQueue('recurring-jobs', { type: 'recurring.process', userId, ts: Date.now() });
}

type BulkUpdateMessage = {
  jobId: string;
  userId: string;
  expenseIds: string[];
  payload: Record<string, unknown>;
};

export async function publishBulkUpdateJob(message: BulkUpdateMessage) {
  await publishToQueue('bulk-jobs', { type: 'bulk.update.expenses', ts: Date.now(), ...message });
}
