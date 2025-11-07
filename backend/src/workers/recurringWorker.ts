import amqp from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { processRecurringExpenses } from '../services/recurringService';

const prisma = new PrismaClient();
const RABBIT_URL =
  process.env.RABBIT_URL || 'amqps://USER:PASSWORD@gorilla.lmq.cloudamqp.com/nokwohlm';

async function startWorker() {
  const connection = await amqp.connect(RABBIT_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('recurring-jobs', { durable: true });
  console.log('[Worker] Waiting for jobs in recurring-jobs queue...');

  channel.consume('recurring-jobs', async (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      console.log('[Worker] Received job:', data);
      const result = await processRecurringExpenses(prisma);
      console.log('[Worker] Completed:', result);
      channel.ack(msg);
    } catch (error) {
      console.error('[Worker] Job failed:', error);
      channel.nack(msg, false, true);
    }
  });
}

startWorker().catch((error) => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});
