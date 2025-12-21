import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { sanitizeUrlForLog } from './lib/logger';
import { redis } from './lib/redisClient';
import { createApp } from './app';

const port = config.port;
const prisma = new PrismaClient();
const app = createApp(prisma);

const resolveRedisTarget = () => {
  if (config.redisUrl) return sanitizeUrlForLog(config.redisUrl);
  if (config.redisHost || config.redisPort) {
    const host = config.redisHost ?? 'redis';
    const port = config.redisPort ?? '6379';
    return sanitizeUrlForLog(`redis://${host}:${port}`);
  }
  if (config.upstashRedisRestUrl && config.upstashRedisRestToken) {
    return sanitizeUrlForLog(config.upstashRedisRestUrl);
  }
  return '';
};

const startServer = async () => {
  const mongoTarget = sanitizeUrlForLog(config.databaseUrl);
  const rabbitTarget = sanitizeUrlForLog(config.rabbitUrl);
  const redisTarget = resolveRedisTarget();
  const statusEndpoint = `http://localhost:${port}/api/status`;
  const allowAllOrigins = config.corsOrigins.length === 0 || config.corsOrigins.includes('*');

  console.log(`[Startup] env=${config.nodeEnv} security=${config.securityMode}`);
  console.log(`[Startup] http port=${port} status=${statusEndpoint}`);
  console.log(`[Startup] cors=${allowAllOrigins ? 'allow all' : config.corsOrigins.join(', ')}`);
  console.log(`[Startup] prisma target=${mongoTarget}`);

  try {
    await prisma.$connect();
    console.log('[Startup] prisma connected');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[Startup] prisma connection failed: ${reason}`);
    process.exit(1);
  }

  if (redisTarget) {
    try {
      const pong = await redis.ping();
      console.log(`[Startup] redis target=${redisTarget} ping=${pong}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[Startup] redis ping failed (${redisTarget}): ${reason}`);
    }
  } else {
    console.log('[Startup] redis: not configured');
  }

  console.log(`[Startup] rabbitmq target=${rabbitTarget}`);

  app.listen(port, () => {
    console.log(`🚀 Backend server pronto e rodando na porta ${port}`);
    console.log(`🔗 Teste em: ${statusEndpoint}`);
  });
};

if (require.main === module) {
  startServer();
}

export { app };
export default app;
