/**
 * Schemas de Validação - Salary History (Histórico Salarial)
 * 
 * Propósito:
 * - Validar criação e atualização de registros de salário
 * - Garantir integridade de valores numéricos (horas, taxas)
 * - Validar formato de mês (YYYY-MM)
 * - Prevenir duplicação de registros (1 por mês/usuário via unique constraint)
 * 
 * Uso:
 * - POST /api/salary (createSalarySchema)
 * - PUT /api/salary/:id (updateSalarySchema)
 * - GET /api/salary (querySalarySchema)
 * - DELETE /api/salary/:id (idParamSchema)
 * 
 * Regras de Negócio:
 * - month: formato YYYY-MM, único por usuário
 * - hours: número positivo, máximo 744 (31 dias * 24h)
 * - hourRate: valor por hora em float, mínimo 0.01
 * - taxRate: percentual entre 0 e 100
 * - cnae: código CNAE (string opcional)
 * 
 * Decisões de Design:
 * - Valores numéricos como number (não string) para facilitar cálculos
 * - Validação de limites razoáveis (horas <= 744, taxRate <= 100)
 * - CNAE opcional (nem todos os freelancers têm)
 * - .strict() para rejeitar campos calculados enviados pelo cliente
 */

import { z } from 'zod';

// ============================================================================
// Helpers Compartilhados
// ============================================================================

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = z.string()
  .regex(OBJECT_ID_REGEX, 'ID inválido: deve ser um ObjectId válido');

/**
 * Validador de mês (formato YYYY-MM)
 */
const monthSchema = z.string()
  .regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM')
  .refine(
    (val) => {
      const [year, month] = val.split('-').map(Number);
      return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
    },
    'Mês inválido (deve estar entre 01 e 12, ano entre 2000 e 2100)'
  );

// ============================================================================
// Schema de Criação de Salary (POST /api/salary)
// ============================================================================

export const createSalarySchema = z.object({
  month: monthSchema,
  
  hours: z.number()
    .positive('Horas deve ser um número positivo')
    .max(744, 'Horas não pode exceder 744 (31 dias * 24h)'),
  
  hourRate: z.number()
    .positive('Valor da hora deve ser positivo')
    .min(0.01, 'Valor da hora deve ser no mínimo 0.01')
    .max(10000, 'Valor da hora não pode exceder 10.000'),
  
  taxRate: z.number()
    .min(0, 'Taxa de imposto deve estar entre 0 e 100')
    .max(100, 'Taxa de imposto deve estar entre 0 e 100'),
  
  cnae: z.string()
    .max(20, 'CNAE muito longo (máximo 20 caracteres)')
    .optional(),
})
.strict();

// ============================================================================
// Schema de Atualização de Salary (PUT /api/salary/:id)
// ============================================================================

export const updateSalarySchema = createSalarySchema.partial().strict();

// ============================================================================
// Schema de Query/Filtros (GET /api/salary)
// ============================================================================

export const querySalarySchema = z.object({
  month: monthSchema.optional(),
  
  // Filtros de range de data
  startMonth: monthSchema.optional(),
  endMonth: monthSchema.optional(),
  
  // Paginação
  page: z.coerce.number()
    .int('Página deve ser um número inteiro')
    .min(1, 'Página deve ser maior que 0')
    .optional(),
  
  limit: z.coerce.number()
    .int('Limit deve ser um número inteiro')
    .min(1, 'Limit deve ser maior que 0')
    .max(100, 'Limit não pode exceder 100')
    .optional(),
}).strict();

// ============================================================================
// Schema de Parâmetros de Rota
// ============================================================================

export const idParamSchema = z.object({
  id: objectIdSchema
}).strict();

// ============================================================================
// Tipos TypeScript Inferidos
// ============================================================================

export type CreateSalaryInput = z.infer<typeof createSalarySchema>;
export type UpdateSalaryInput = z.infer<typeof updateSalarySchema>;
export type QuerySalaryInput = z.infer<typeof querySalarySchema>;
export type IdParamInput = z.infer<typeof idParamSchema>;
