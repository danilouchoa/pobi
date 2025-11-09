/**
 * HEALTH CHECK ENDPOINT
 * 
 * Este endpoint é crucial para observabilidade e orquestração de containers Docker.
 * Ele verifica a saúde de todas as dependências críticas do sistema:
 * 
 * 1. MongoDB (via Prisma) - Banco de dados principal
 * 2. Redis (Upstash) - Cache e sessões
 * 3. RabbitMQ (CloudAMQP) - Mensageria para jobs assíncronos
 * 
 * O Docker Compose usa este endpoint para determinar quando um container está
 * realmente pronto para receber tráfego, evitando erros de "connection refused"
 * durante o startup.
 * 
 * FORMATO DE RESPOSTA:
 * - Status 200: Todas as dependências OK
 * - Status 503: Uma ou mais dependências com falha
 * 
 * EXEMPLO:
 * GET /api/health
 * {
 *   "status": "ok",
 *   "timestamp": "2025-11-08T23:59:59.999Z",
 *   "uptime": 123.45,
 *   "dependencies": {
 *     "mongo": "connected",
 *     "redis": "connected",
 *     "rabbitmq": "connected"
 *   }
 * }
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { redis as redisClient } from '../lib/redisClient';
import amqp from 'amqplib';

const router = Router();
const prisma = new PrismaClient();

/**
 * Interface para o resultado de cada verificação de saúde.
 * Permite rastrear não apenas o status, mas também latência e mensagens de erro.
 */
interface HealthCheck {
  status: 'connected' | 'disconnected' | 'degraded';
  latency?: number; // Tempo de resposta em ms
  error?: string;   // Mensagem de erro se houver falha
}

/**
 * Interface para a resposta completa do health check.
 */
interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  dependencies: {
    mongo: HealthCheck;
    redis: HealthCheck;
    rabbitmq: HealthCheck;
  };
}

/**
 * Verifica a conectividade com o MongoDB via Prisma.
 * 
 * ESTRATÉGIA:
 * - Usa $queryRaw com comando nativo do MongoDB (ping)
 * - Mede latência da operação
 * - Timeout implícito via configuração do Prisma Client
 * 
 * POR QUE PING E NÃO UMA QUERY REAL?
 * - Ping é a operação mais leve possível
 * - Não altera estado do banco
 * - Retorna imediatamente se a conexão está ativa
 * 
 * @returns Status da conexão e latência em ms
 */
async function checkMongo(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    // Comando nativo do MongoDB que apenas verifica conectividade
    // Usa $runCommandRaw para executar comando ping do MongoDB
    await prisma.$runCommandRaw({ ping: 1 });
    
    const latency = Date.now() - start;
    
    return {
      status: 'connected',
      latency
    };
  } catch (error: any) {
    return {
      status: 'disconnected',
      error: error.message || 'MongoDB connection failed'
    };
  }
}

/**
 * Verifica a conectividade com o Redis (Upstash).
 * 
 * ESTRATÉGIA:
 * - Usa comando PING do Redis
 * - Mede latência da operação
 * - Timeout configurado no cliente Redis
 * 
 * IMPORTÂNCIA:
 * - Cache é crítico para performance do sistema
 * - Se Redis cair, queries vão direto ao MongoDB (mais lento)
 * - Health check permite detectar degradação de performance
 * 
 * @returns Status da conexão e latência em ms
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    // PING retorna "PONG" se o servidor está responsivo
    const response = await redisClient.ping();
    
    if (response !== 'PONG') {
      return {
        status: 'degraded',
        error: `Unexpected response: ${response}`
      };
    }
    
    const latency = Date.now() - start;
    
    return {
      status: 'connected',
      latency
    };
  } catch (error: any) {
    return {
      status: 'disconnected',
      error: error.message || 'Redis connection failed'
    };
  }
}

/**
 * Verifica a conectividade com o RabbitMQ (CloudAMQP).
 * 
 * ESTRATÉGIA:
 * - Cria conexão temporária
 * - Abre um canal (operação que exige broker ativo)
 * - Fecha conexão imediatamente após verificação
 * 
 * POR QUE NÃO REUTILIZAR CONEXÃO EXISTENTE?
 * - Health check deve ser independente do estado da aplicação
 * - Conexões podem estar em cache e aparentar saúde quando não estão
 * - Nova conexão garante teste real de disponibilidade
 * 
 * TRADE-OFF:
 * - Overhead de criar conexão para cada health check
 * - Mitigado por: interval de 30s (não é chamado constantemente)
 * 
 * @returns Status da conexão e latência em ms
 */
async function checkRabbitMQ(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    const rabbitURL = process.env.RABBIT_URL;
    
    if (!rabbitURL) {
      return {
        status: 'disconnected',
        error: 'RABBIT_URL not configured'
      };
    }
    
    // Conecta ao RabbitMQ com timeout de 5 segundos
    const connection = await amqp.connect(rabbitURL, {
      timeout: 5000
    });
    
    // Criar um canal é a operação mínima para validar que o broker está funcional
    // Um canal permite declarar filas, publicar e consumir mensagens
    const channel = await connection.createChannel();
    
    // Fechar canal e conexão imediatamente
    // Importante: fechar na ordem correta (canal → conexão)
    await channel.close();
    await connection.close();
    
    const latency = Date.now() - start;
    
    return {
      status: 'connected',
      latency
    };
  } catch (error: any) {
    return {
      status: 'disconnected',
      error: error.message || 'RabbitMQ connection failed'
    };
  }
}

/**
 * GET /api/health
 * 
 * Endpoint principal de health check.
 * 
 * COMPORTAMENTO:
 * - Executa todas as verificações em paralelo (Promise.all)
 * - Retorna 200 se TODAS as dependências estão OK
 * - Retorna 503 (Service Unavailable) se UMA ou MAIS dependências falharem
 * 
 * POR QUE PARALELO E NÃO SEQUENCIAL?
 * - Reduz tempo total de resposta (3 checks de 100ms = 100ms vs 300ms)
 * - Não há dependência entre as verificações
 * - Docker Compose tem timeout de 10s, então precisamos ser rápidos
 * 
 * USO NO DOCKER COMPOSE:
 * healthcheck:
 *   test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
 *   
 * O flag -f faz curl retornar exit code 22 se status >= 400
 * Isso marca o container como unhealthy automaticamente
 */
router.get('/', async (req, res) => {
  try {
    // Executa todas as verificações em paralelo para performance
    const [mongo, redis, rabbitmq] = await Promise.all([
      checkMongo(),
      checkRedis(),
      checkRabbitMQ()
    ]);
    
    // Determina o status geral baseado no status individual
    // unhealthy: pelo menos uma dependência disconnected
    // degraded: pelo menos uma dependência degraded (mas nenhuma disconnected)
    // ok: todas as dependências connected
    const allConnected = 
      mongo.status === 'connected' && 
      redis.status === 'connected' && 
      rabbitmq.status === 'connected';
    
    const hasDisconnected = 
      mongo.status === 'disconnected' || 
      redis.status === 'disconnected' || 
      rabbitmq.status === 'disconnected';
    
    const overallStatus = hasDisconnected 
      ? 'unhealthy' 
      : allConnected 
        ? 'ok' 
        : 'degraded';
    
    // Calcula uptime do processo em segundos
    // Útil para detectar restart loops
    const uptime = process.uptime();
    
    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime * 100) / 100, // Arredondar para 2 decimais
      dependencies: {
        mongo,
        redis,
        rabbitmq
      }
    };
    
    // Status HTTP baseado na saúde geral:
    // 200: Sistema saudável, pode receber tráfego
    // 503: Sistema com problemas, não deve receber tráfego
    const statusCode = overallStatus === 'ok' ? 200 : 503;
    
    res.status(statusCode).json(response);
    
  } catch (error: any) {
    // Erro inesperado durante health check
    // Isso não deveria acontecer, mas precisamos tratar
    console.error('[HEALTH] Unexpected error during health check:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error.message || 'Internal health check error',
      dependencies: {
        mongo: { status: 'disconnected', error: 'check failed' },
        redis: { status: 'disconnected', error: 'check failed' },
        rabbitmq: { status: 'disconnected', error: 'check failed' }
      }
    });
  }
});

/**
 * GET /api/health/ready
 * 
 * Readiness probe alternativo.
 * 
 * DIFERENÇA DE /api/health:
 * - /health: Liveness (está vivo?)
 * - /ready: Readiness (está pronto para receber tráfego?)
 * 
 * KUBERNETES-STYLE:
 * - Liveness: Se falhar, reinicia o container
 * - Readiness: Se falhar, remove do load balancer
 * 
 * Para Docker Compose simples, ambos são equivalentes.
 * Mas fica preparado para migração futura para K8s.
 */
router.get('/ready', async (req, res) => {
  // Por enquanto, readiness = liveness
  // No futuro, pode incluir checks adicionais como:
  // - Fila de mensagens tem backlog < X?
  // - CPU usage < 80%?
  // - Memória disponível > 100MB?
  
  res.redirect(308, '/api/health');
});

export default router;
