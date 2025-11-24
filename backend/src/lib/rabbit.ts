import { connect, type ConfirmChannel } from 'amqplib';
import crypto from 'crypto';

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq:5672';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RabbitConnection = Awaited<ReturnType<typeof connect>>;

type RabbitContext = {
  connection: RabbitConnection;
  channel: ConfirmChannel;
};

let sharedConnection: RabbitConnection | null = null;
let sharedChannel: ConfirmChannel | null = null;
const consumerContexts = new Map<string, RabbitContext>();

const formatError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const logConnected = () => {
  console.log('[Rabbit] Connected and queue ready');
};

const attachConnectionHandlers = (connection: RabbitConnection, onClose: () => void) => {
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

async function connectWithRetry(context: string): Promise<RabbitConnection> {
  let attempt = 0;
  // Retry loop is intentional to maintain connectivity with backoff
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const connection = await connect(RABBIT_URL, { timeout: 5000 });
      console.log(`[Rabbit] Connected (${context})`);
      return connection;
    } catch (error) {
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 10_000);
      console.error(`[Rabbit] Connection error (${context}) attempt ${attempt}:`, formatError(error));
      console.warn(`[Rabbit] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

const ensureSharedConnection = async (): Promise<RabbitConnection> => {
  if (sharedConnection) return sharedConnection;
  const connection = await connectWithRetry('shared');
  sharedConnection = connection;
  attachConnectionHandlers(connection, () => {
    sharedConnection = null;
    sharedChannel = null;
  });
  return connection;
};

const ensureSharedChannel = async (): Promise<ConfirmChannel> => {
  if (sharedChannel) return sharedChannel;
  const connection = await ensureSharedConnection();
  const channel = await connection.createConfirmChannel();
  sharedChannel = channel;
  attachChannelHandlers(channel, () => {
    sharedChannel = null;
  });
  
  // Dead Letter Exchange (DLX) para mensagens que falharam múltiplas vezes
  await channel.assertExchange('dlx-exchange', 'direct', { durable: true });
  await channel.assertQueue('dead-letter-queue', { durable: true });
  await channel.bindQueue('dead-letter-queue', 'dlx-exchange', '');
  
  // Filas principais com DLX configurado
  await channel.assertQueue('recurring-jobs', { 
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx-exchange'
    }
  });
  await channel.assertQueue('bulkUpdateQueue', { 
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx-exchange'
    }
  });
  
  logConnected();
  return channel;
};

async function openContext(options: {
  queue: string;
  prefetch?: number;
}): Promise<RabbitContext> {
  const connection = await connectWithRetry(options.queue);
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
  
  // Configurar DLX para workers
  await channel.assertExchange('dlx-exchange', 'direct', { durable: true });
  await channel.assertQueue('dead-letter-queue', { durable: true });
  await channel.bindQueue('dead-letter-queue', 'dlx-exchange', '');
  
  await channel.assertQueue(options.queue, { 
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx-exchange'
    }
  });
  
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

/**
 * DLQ Management Functions
 */

/**
 * Obtém estatísticas da Dead Letter Queue
 * @returns Objeto com messageCount e consumerCount
 */
export async function getDLQStats(): Promise<{ messageCount: number; consumerCount: number }> {
  const channel = await ensureSharedChannel();
  const info = await channel.checkQueue('dead-letter-queue');
  return {
    messageCount: info.messageCount,
    consumerCount: info.consumerCount,
  };
}

/**
 * Lista mensagens da DLQ (peek sem remover)
 * @param limit Número máximo de mensagens a retornar
 * @returns Array de mensagens com metadata
 */
export async function peekDLQMessages(limit = 10): Promise<Array<{
  content: unknown;
  fields: {
    deliveryTag: number;
    redelivered: boolean;
    routingKey: string;
  };
  properties: {
    correlationId?: string;
    messageId?: string;
    timestamp?: number;
    headers?: Record<string, unknown>;
  };
}>> {
  const channel = await ensureSharedChannel();
  const messages: Array<{
    content: unknown;
    fields: { deliveryTag: number; redelivered: boolean; routingKey: string };
    properties: {
      correlationId?: string;
      messageId?: string;
      timestamp?: number;
      headers?: Record<string, unknown>;
    };
  }> = [];

  for (let i = 0; i < limit; i++) {
    const msg = await channel.get('dead-letter-queue', { noAck: false });
    if (!msg) break;
    
    try {
      const content = JSON.parse(msg.content.toString());
      messages.push({
        content,
        fields: {
          deliveryTag: msg.fields.deliveryTag,
          redelivered: msg.fields.redelivered,
          routingKey: msg.fields.routingKey,
        },
        properties: {
          correlationId: msg.properties.correlationId,
          messageId: msg.properties.messageId,
          timestamp: msg.properties.timestamp,
          headers: msg.properties.headers,
        },
      });
      // Nack para devolver a mensagem à fila (peek)
      channel.nack(msg, false, true);
    } catch (error) {
      console.error('[DLQ] Error parsing message:', error);
      // Nack mesmo em caso de erro para não perder a mensagem
      channel.nack(msg, false, true);
    }
  }

  return messages;
}

/**
 * Reprocessa uma mensagem específica da DLQ enviando para a fila original
 * @param deliveryTag Tag da mensagem a reprocessar
 * @param targetQueue Fila de destino (recurring-jobs ou bulkUpdateQueue)
 * @returns true se sucesso, false se mensagem não encontrada
 */
export async function reprocessDLQMessage(
  deliveryTag: number,
  targetQueue: 'recurring-jobs' | 'bulkUpdateQueue'
): Promise<boolean> {
  const channel = await ensureSharedChannel();
  const msg = await channel.get('dead-letter-queue', { noAck: false });
  
  if (!msg || msg.fields.deliveryTag !== deliveryTag) {
    if (msg) {
      // Devolver mensagem se não for a procurada
      channel.nack(msg, false, true);
    }
    return false;
  }

  try {
    const content = JSON.parse(msg.content.toString());
    
    // Republicar na fila original
    await publishToQueue(targetQueue, content, msg.properties.correlationId);
    
    // Ack para remover da DLQ
    channel.ack(msg);
    console.log(`[DLQ] Message ${deliveryTag} reprocessed to ${targetQueue}`);
    return true;
  } catch (error) {
    console.error('[DLQ] Error reprocessing message:', error);
    // Nack para devolver à DLQ em caso de erro
    channel.nack(msg, false, true);
    return false;
  }
}

/**
 * Purga todas as mensagens da DLQ (uso com cautela!)
 * @returns Número de mensagens removidas
 */
export async function purgeDLQ(): Promise<number> {
  const channel = await ensureSharedChannel();
  const result = await channel.purgeQueue('dead-letter-queue');
  console.log(`[DLQ] Purged ${result.messageCount} messages`);
  return result.messageCount;
}
