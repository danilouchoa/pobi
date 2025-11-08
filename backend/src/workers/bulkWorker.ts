import type { ConsumeMessage } from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { createRabbit } from '../lib/rabbit';
import { applyBulkUpdate, BulkUpdateJob } from '../services/bulkUpdateService';

const prisma = new PrismaClient();
const QUEUE_NAME = 'bulk-jobs';
const PREFETCH = 5;

const formatError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function startBulkWorker() {
  const { connection, channel } = await createRabbit({ queue: QUEUE_NAME, prefetch: PREFETCH });
  let shuttingDown = false;

  const shutdown = async (signal?: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (signal) {
      console.log(`[BulkWorker] Received ${signal}. Closing resources...`);
    }
    try {
      await channel.close();
    } catch (error) {
      console.warn('[BulkWorker] Failed to close channel gracefully:', formatError(error));
    }
    try {
      await connection.close();
    } catch (error) {
      console.warn('[BulkWorker] Failed to close connection gracefully:', formatError(error));
    }
    await prisma.$disconnect();
    process.exit(signal ? 0 : 1);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  connection.on('error', (error: unknown) => {
    console.error('[BulkWorker] Connection error:', formatError(error));
  });

  connection.on('close', () => {
    if (!shuttingDown) {
      console.error('[BulkWorker] Connection closed unexpectedly. Exiting...');
      shutdown().catch((err) => {
        console.error('[BulkWorker] Error during shutdown:', formatError(err));
        process.exit(1);
      });
    }
  });

  console.log('[BulkWorker] Waiting for jobs in bulk-jobs queue...');

  channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as BulkUpdateJob;
      const result = await applyBulkUpdate(prisma, payload);
      console.log('[BulkWorker][BulkUpdate] Bulk update done:', {
        jobId: payload.jobId,
        count: result.count,
      });
      channel.ack(msg);
    } catch (error) {
      console.error('[BulkWorker][BulkUpdate] Failed job:', formatError(error));
      channel.nack(msg, false, true);
    }
  });
}

startBulkWorker().catch(async (error) => {
  console.error('[BulkWorker] Fatal error during startup:', formatError(error));
  await prisma.$disconnect();
  process.exit(1);
});
