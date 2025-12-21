/**
 * Dead Letter Queue (DLQ) Admin Routes
 *
 * Endpoints para monitoramento e gerenciamento de mensagens que falharam
 * após múltiplas tentativas de processamento.
 *
 * Rotas:
 * - GET /api/dlq/stats - Estatísticas da DLQ (contagem de mensagens)
 * - GET /api/dlq/messages - Lista mensagens na DLQ (peek sem remover)
 * - POST /api/dlq/reprocess/:deliveryTag - Reprocessa mensagem específica
 * - DELETE /api/dlq/purge - Remove todas mensagens (uso com cautela!)
 */

import { Router } from 'express';
import { getDLQStats, peekDLQMessages, reprocessDLQMessage, purgeDLQ } from '../lib/rabbit';
import { adminLimiter } from '../middlewares/rateLimiter';
import { requireEmailVerified } from '../middlewares/emailVerified';
import type { PrismaClientLike } from '../types/prisma';

export default function dlqRoutes(prisma: PrismaClientLike) {
  const router = Router();

  router.use(requireEmailVerified(prisma));

  /**
   * GET /api/dlq/stats
   *
   * Retorna estatísticas da Dead Letter Queue
   *
   * Response 200:
   * {
   *   "messageCount": 5,
   *   "consumerCount": 0
   * }
   */
  router.get('/stats', adminLimiter, async (req, res, next) => {
    try {
      const stats = await getDLQStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/dlq/messages?limit=10
   *
   * Lista mensagens da DLQ sem removê-las (peek)
   *
   * Query Params:
   * - limit: número máximo de mensagens (default: 10, max: 100)
   *
   * Response 200:
   * {
   *   "messages": [
   *     {
   *       "content": { "type": "recurring.process", "userId": "..." },
   *       "fields": {
   *         "deliveryTag": 1,
   *         "redelivered": true,
   *         "routingKey": ""
   *       },
   *       "properties": {
   *         "correlationId": "uuid",
   *         "messageId": "uuid",
   *         "timestamp": 1699488000000,
   *         "headers": {
   *           "x-retry-count": 3,
   *           "x-first-death-queue": "recurring-jobs",
   *           "x-last-error": "Connection timeout"
   *         }
   *       }
   *     }
   *   ],
   *   "count": 1
   * }
   */
  router.get('/messages', adminLimiter, async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const messages = await peekDLQMessages(limit);
      res.json({
        messages,
        count: messages.length,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/dlq/reprocess/:deliveryTag
   *
   * Reprocessa uma mensagem específica da DLQ enviando para a fila original
   *
   * Path Params:
   * - deliveryTag: ID da mensagem a reprocessar
   *
   * Body:
   * {
   *   "targetQueue": "recurring-jobs" | "bulkUpdateQueue"
   * }
   *
   * Response 200:
   * {
   *   "success": true,
   *   "message": "Mensagem reprocessada com sucesso"
   * }
   *
   * Response 404:
   * {
   *   "error": "NOT_FOUND",
   *   "message": "Mensagem não encontrada na DLQ"
   * }
   */
  router.post('/reprocess/:deliveryTag', adminLimiter, async (req, res, next) => {
    try {
      const deliveryTag = parseInt(req.params.deliveryTag);
      const { targetQueue } = req.body;

      if (!targetQueue || !['recurring-jobs', 'bulkUpdateQueue'].includes(targetQueue)) {
        return res.status(400).json({
          error: 'INVALID_QUEUE',
          message: 'targetQueue deve ser "recurring-jobs" ou "bulkUpdateQueue"',
        });
      }

      const success = await reprocessDLQMessage(deliveryTag, targetQueue);

      if (!success) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Mensagem não encontrada na DLQ',
        });
      }

      res.json({
        success: true,
        message: 'Mensagem reprocessada com sucesso',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/dlq/purge
   *
   * Remove TODAS as mensagens da DLQ (uso com cautela!)
   *
   * Response 200:
   * {
   *   "success": true,
   *   "purgedCount": 15,
   *   "message": "15 mensagens removidas da DLQ"
   * }
   */
  router.delete('/purge', adminLimiter, async (req, res, next) => {
    try {
      const purgedCount = await purgeDLQ();
      res.json({
        success: true,
        purgedCount,
        message: `${purgedCount} mensagens removidas da DLQ`,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
