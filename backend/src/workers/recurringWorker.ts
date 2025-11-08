import amqp from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { processRecurringExpenses } from '../services/recurringService';

type ConfirmConnection = amqp.Connection & {
  createConfirmChannel: () => Promise<amqp.ConfirmChannel>;
};

const prisma = new PrismaClient();
const RABBIT_URL =
  process.env.RABBIT_URL || 'amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm';
const QUEUE_NAME = 'recurring-jobs';
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

let connection: ConfirmConnection | undefined;
let channel: amqp.ConfirmChannel | undefined;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

const cleanupConnection = async () => {
  if (channel) {
    try {
      await channel.close();
    } catch (err) {
      console.warn('[Worker] Error closing channel:', err);
    }
    channel = undefined;
  }
  if (connection) {
    try {
      const conn = connection as unknown as { close: () => Promise<void> };
      await conn.close();
    } catch (err) {
      console.warn('[Worker] Error closing connection:', err);
    }
    connection = undefined;
  }
};

const gracefullyExit = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
  await cleanupConnection();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefullyExit);
process.on('SIGTERM', gracefullyExit);

const scheduleReconnect = () => {
  if (shuttingDown) return;
  const delay = Math.min(BASE_DELAY_MS * 2 ** reconnectAttempts, MAX_DELAY_MS);
  reconnectAttempts += 1;
  console.warn(`[Worker] Reconnecting in ${delay}ms...`);
  reconnectTimer = setTimeout(connectWithRetry, delay);
};

const handleConnectionClose = () => {
  if (shuttingDown) return;
  console.warn('[Worker] Connection closed. Scheduling reconnect...');
  cleanupConnection().catch((err) => console.error('[Worker] Cleanup error:', err));
  scheduleReconnect();
};

const setupConsumer = async () => {
  connection = (await amqp.connect(RABBIT_URL)) as unknown as ConfirmConnection;
  connection.on('close', handleConnectionClose);
  connection.on('error', (err) => console.error('[Worker] Connection error:', err));

  const confirmChannel = (await connection.createConfirmChannel()) as unknown as amqp.ConfirmChannel;
  channel = confirmChannel;
  await confirmChannel.assertQueue(QUEUE_NAME, { durable: true });
  await confirmChannel.prefetch(10);

  console.log('[Worker] Waiting for jobs in recurring-jobs queue...');

  confirmChannel.consume(QUEUE_NAME, async (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;
    const activeChannel = channel;
    if (!activeChannel) return;
    try {
      const data = JSON.parse(msg.content.toString());
      console.log('[Worker] Received job:', data);
      const result = await processRecurringExpenses(prisma);
      console.log('[Worker] Completed:', result);
      activeChannel.ack(msg);
    } catch (error) {
      console.error('[Worker] Job failed:', error);
      activeChannel.nack(msg, false, true);
    }
  });
};

const connectWithRetry = async () => {
  if (shuttingDown) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
  try {
    await setupConsumer();
    reconnectAttempts = 0;
  } catch (error) {
    console.error('[Worker] Failed to establish connection:', error);
    scheduleReconnect();
  }
};

connectWithRetry().catch((error) => {
  console.error('[Worker] Fatal error during startup:', error);
  process.exit(1);
});
