/**
 * Middleware de Validação Genérica
 * 
 * Propósito:
 * - Validar entrada de dados (body, query, params) usando schemas Zod
 * - Retornar erros 400 padronizados e legíveis em caso de falha
 * - Evitar stack-trace em logs para erros esperados de validação
 * - Respeitar feature flag VALIDATION_ENABLED para rollout gradual
 * - Fornecer telemetria básica (contadores de falhas)
 * 
 * Uso:
 * ```typescript
 * import { validate } from '../middlewares/validation';
 * import { createExpenseSchema, queryExpenseSchema, idParamSchema } from '../schemas/expense.schema';
 * 
 * // Validar body
 * router.post('/expenses', validate({ body: createExpenseSchema }), async (req, res) => {
 *   // req.body já está validado e tipado
 * });
 * 
 * // Validar query params
 * router.get('/expenses', validate({ query: queryExpenseSchema }), async (req, res) => {
 *   // req.query já está validado
 * });
 * 
 * // Validar path params
 * router.delete('/expenses/:id', validate({ params: idParamSchema }), async (req, res) => {
 *   // req.params.id já está validado como ObjectId
 * });
 * 
 * // Validar múltiplas fontes
 * router.put('/expenses/:id', 
 *   validate({ 
 *     params: idParamSchema, 
 *     body: updateExpenseSchema 
 *   }), 
 *   async (req, res) => {
 *     // Ambos validados
 *   }
 * );
 * ```
 * 
 * Comportamento com Feature Flag:
 * - VALIDATION_ENABLED=true (default): Valida entrada, retorna 400 em falhas
 * - VALIDATION_ENABLED=false: Passa direto sem validar (útil para rollback)
 * 
 * Formato de Resposta de Erro (400):
 * ```json
 * {
 *   "error": "Erro de validação",
 *   "message": "Os dados enviados são inválidos",
 *   "details": [
 *     {
 *       "field": "amount",
 *       "message": "Valor monetário deve estar no formato \"0.00\""
 *     },
 *     {
 *       "field": "date",
 *       "message": "Data inválida: deve ser uma data válida (ISO 8601)"
 *     }
 *   ]
 * }
 * ```
 * 
 * Logging:
 * - Validações com falha: log level "warn" SEM stack-trace
 * - Inclui contadores de falhas por campo para telemetria
 * - Não loga dados sensíveis (senhas, tokens)
 * - Exceções não tratadas: log level "error" COM stack-trace
 * 
 * Trade-offs:
 * - Performance: validação adiciona ~5-10ms por request (aceitável para reduzir bugs)
 * - Segurança: rejeitar campos extras previne mass assignment attacks
 * - DX: mensagens de erro claras reduzem tempo de debug
 * - Rollout: feature flag permite desativar validação em emergências
 * 
 * Telemetria:
 * - Contador em memória de falhas por rota (validationFailures)
 * - Contadores por campo (validationFailuresByField)
 * - Pode ser exportado para Prometheus/Datadog no futuro
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { config } from '../config';

// ============================================================================
// Telemetria (contadores em memória)
// ============================================================================

/**
 * Contador de falhas de validação por rota
 * Formato: { "POST /api/expenses": 42, "PUT /api/origins/:id": 7 }
 */
const validationFailures: Record<string, number> = {};

/**
 * Contador de falhas por campo
 * Formato: { "amount": 15, "date": 8, "closingDay": 3 }
 */
const validationFailuresByField: Record<string, number> = {};

/**
 * Incrementa contadores de telemetria
 */
function incrementValidationCounters(route: string, fields: string[]) {
  // Incrementar contador da rota
  validationFailures[route] = (validationFailures[route] || 0) + 1;
  
  // Incrementar contadores por campo
  fields.forEach(field => {
    validationFailuresByField[field] = (validationFailuresByField[field] || 0) + 1;
  });
}

/**
 * Retorna métricas de validação (útil para debugging e monitoramento)
 */
export function getValidationMetrics() {
  return {
    failuresByRoute: validationFailures,
    failuresByField: validationFailuresByField,
    totalFailures: Object.values(validationFailures).reduce((sum, count) => sum + count, 0)
  };
}

// ============================================================================
// Tipos
// ============================================================================

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationErrorResponse {
  error: string;
  message: string;
  details: ValidationError[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formata erros do Zod para o padrão de resposta da API
 */
function formatZodError(error: ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }));
}

/**
 * Cria resposta de erro padronizada
 */
function createValidationErrorResponse(errors: ValidationError[]): ValidationErrorResponse {
  return {
    error: 'Erro de validação',
    message: 'Os dados enviados são inválidos',
    details: errors
  };
}

/**
 * Loga falha de validação SEM stack-trace
 */
function logValidationFailure(req: Request, errors: ValidationError[]) {
  const route = `${req.method} ${req.route?.path || req.path}`;
  const fields = errors.map(e => e.field);
  
  console.warn('[VALIDATION]', {
    route,
    method: req.method,
    path: req.path,
    failedFields: fields,
    errorCount: errors.length,
    // Não logamos o payload completo para não vazar dados sensíveis
    // Em produção, considerar usar logger estruturado (Winston, Pino)
  });
  
  // Incrementar contadores de telemetria
  incrementValidationCounters(route, fields);
}

// ============================================================================
// Middleware de Validação
// ============================================================================

/**
 * Middleware genérico de validação com Zod
 * 
 * @param schemas - Schemas Zod para validar body, query e/ou params
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * router.post('/expenses', 
 *   validate({ body: createExpenseSchema }), 
 *   async (req, res) => {
 *     // req.body validado
 *   }
 * );
 * ```
 */
export function validate(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ========================================================================
    // 1. Verificar Feature Flag
    // ========================================================================
    if (!config.validationEnabled) {
      // Flag desativada: passar direto sem validar
      // Útil para rollback rápido em caso de falso positivo
      return next();
    }
    
    // ========================================================================
    // 2. Validar Cada Fonte de Dados (body, query, params)
    // ========================================================================
    const errors: ValidationError[] = [];
    
    try {
      // Validar body
      if (schemas.body) {
        try {
          const validatedBody = schemas.body.parse(req.body);
          req.body = validatedBody;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error));
          } else {
            throw error; // Re-throw exceções não previstas
          }
        }
      }
      
      // Validar query
      // NOTA: req.query é read-only no Express, então validamos sem sobrescrever
      // A transformação do Zod (ex: coerce.number) será aplicada, mas o tipo original
      // permanece em req.query. O controller deve confiar que a validação passou.
      if (schemas.query) {
        try {
          schemas.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error));
          } else {
            throw error;
          }
        }
      }
      
      // Validar params
      if (schemas.params) {
        try {
          const validatedParams = schemas.params.parse(req.params);
          req.params = validatedParams;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error));
          } else {
            throw error;
          }
        }
      }
      
      // ======================================================================
      // 3. Retornar Erro 400 se Houver Falhas
      // ======================================================================
      if (errors.length > 0) {
        logValidationFailure(req, errors);
        
        return res.status(400).json(createValidationErrorResponse(errors));
      }
      
      // ======================================================================
      // 4. Prosseguir se Tudo OK
      // ======================================================================
      next();
      
    } catch (error) {
      // ======================================================================
      // 5. Tratar Exceções Não Previstas (COM stack-trace)
      // ======================================================================
      console.error('[VALIDATION] Erro inesperado durante validação:', error);
      
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro ao processar sua requisição'
      });
    }
  };
}

// ============================================================================
// Exportações
// ============================================================================

export { ValidationSchemas, ValidationError, ValidationErrorResponse };
