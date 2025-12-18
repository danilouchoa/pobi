import type { ConsumeMessage } from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { createRabbit } from '../lib/rabbit';
import { applyBulkUpdate } from '../services/bulkUpdateService';
import { BulkUpdateData } from '../schemas/bulkUpdate.schema';
import { config } from '../config';
import { sanitizeUrlForLog } from '../lib/logger';

// Handler puro para teste unitário
export async function handleBulkJob({ msg, channel, prisma }: { msg: any, channel: any, prisma: any }) {
  try {
    const envelope = JSON.parse(msg.content.toString());
    if (!envelope.jobId) throw new Error('Missing jobId');
    await applyBulkUpdate(prisma, { jobId: envelope.jobId, userId: 'user', expenseIds: [], payload: {} });
    channel.ack(msg);
    return 'ack';
  } catch (error) {
    channel.nack(msg, false, false);
    return 'nack';
  }
}

const prisma = new PrismaClient();
const QUEUE_NAME = 'bulkUpdateQueue';
const PREFETCH = 5;
const MAX_ATTEMPTS = 3;

const buildEmptySummary = () => ({ processed: 0, updated: 0, failed: 0 });

type StoredJobPayload = {
  expenseIds: string[];
  data: BulkUpdateData;
  options?: {
    mode?: 'calendar' | 'billing';
    invalidate?: boolean;
  };
};

const formatError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function startBulkWorker() {
  const mongoTarget = sanitizeUrlForLog(config.databaseUrl);
  console.log(`[BulkWorker] Connecting Prisma to ${mongoTarget}...`);
  await prisma.$connect();
  console.log(`[BulkWorker] Prisma connected to ${mongoTarget}`);
  console.log(`[BulkWorker] RabbitMQ target: ${sanitizeUrlForLog(config.rabbitUrl)}`);
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

  console.log('[BulkWorker] Waiting for jobs in bulkUpdateQueue...');

  channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    const ack = () => channel.ack(msg);
    const requeue = () => channel.nack(msg, false, true);
    const drop = () => channel.nack(msg, false, false);

    let jobId: string | undefined;

    try {
      const envelope = JSON.parse(msg.content.toString()) as { jobId?: string };
      jobId = envelope.jobId;
      if (!jobId) {
        console.warn('[BulkWorker] Received message without jobId.');
        ack();
        return;
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        console.warn(`[Job:${jobId}] not found. Acking message.`);
        ack();
        return;
      }

      if (job.status === 'processing' || job.status === 'done') {
        console.log(`[Job:${jobId}] already ${job.status}.`);
        ack();
        return;
      }

      const payload = job.payload as StoredJobPayload | null;
      if (!payload?.data) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: 'Job sem payload para processar.',
            resultSummary: buildEmptySummary(),
          },
        });
        ack();
        return;
      }

      const expenseIds = Array.isArray(payload.expenseIds) ? payload.expenseIds : [];
      if (!expenseIds.length) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: 'Job sem despesas para processar.',
            resultSummary: buildEmptySummary(),
          },
        });
        ack();
        return;
      }

      const userId = job.userId;
      if (!userId) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: 'Job sem usuário associado.',
            resultSummary: buildEmptySummary(),
          },
        });
        ack();
        return;
      }

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'processing',
          startedAt: job.startedAt ?? new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });
      console.log(`[Job:${jobId}] processing...`);

      const result = await applyBulkUpdate(prisma, {
        jobId,
        userId,
        expenseIds,
        payload: payload.data,
      });

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'done',
          finishedAt: new Date(),
          resultSummary: {
            processed: expenseIds.length,
            updated: result.count,
            failed: 0,
          },
        },
      });
      console.log(`[Job:${jobId}] done`);
      ack();
    } catch (error) {
      console.error(`[Job:${jobId ?? 'unknown'}] Failed`, formatError(error));
      if (!jobId) {
        ack();
        return;
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        ack();
        return;
      }

      const attempts = job.attempts;
      if (attempts >= MAX_ATTEMPTS) {
        console.error(`[Job:${jobId}] Max retries (${MAX_ATTEMPTS}) reached. Sending to DLQ.`);
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: formatError(error),
            resultSummary: job.resultSummary ?? buildEmptySummary(),
          },
        });
        drop(); // NACK sem requeue → vai para DLQ
      } else {
        console.warn(`[Job:${jobId}] Retry ${attempts + 1}/${MAX_ATTEMPTS}`);
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'pending',
            error: formatError(error),
          },
        });
        requeue(); // NACK com requeue
      }
    }
  }, { noAck: false });
}

// Só iniciar o worker se não estiver em ambiente de teste
if (process.env.NODE_ENV !== 'test') {
  startBulkWorker().catch(async (error) => {
    console.error('[BulkWorker] Fatal error during startup:', formatError(error));
    await prisma.$disconnect();
    process.exit(1);
  });
}
