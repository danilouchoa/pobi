/**
 * Schemas de Validação - Catalogs (Devedores e Categorias)
 * 
 * Propósito:
 * - Validar criação e atualização de catálogos (debtors)
 * - Garantir nomes únicos e não vazios
 * - Validar status e flags de ativação
 * - Prevenir criação de catálogos duplicados
 * 
 * Uso:
 * - POST /api/debtors (createDebtorSchema)
 * - PUT /api/debtors/:id (updateDebtorSchema)
 * - GET /api/debtors (queryDebtorSchema)
 * - DELETE /api/debtors/:id (idParamSchema)
 * 
 * Regras de Negócio:
 * - name: obrigatório, mínimo 2 caracteres
 * - status: enum ["Ativo", "Inativo"]
 * - active: boolean (soft delete)
 * 
 * Decisões de Design:
 * - Validações simples (catálogos são entidades básicas)
 * - Nome mínimo 2 caracteres para evitar entradas vazias ou confusas
 * - Status opcional (default "Ativo" no backend)
 * - .strict() para rejeitar campos extras
 * 
 * Nota:
 * - Categorias não têm CRUD próprio, são strings livres nas despesas
 * - Debtors (devedores) são entidades reais no banco
 */

import { z } from 'zod';

// ============================================================================
// Helpers Compartilhados
// ============================================================================

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = z.string()
  .regex(OBJECT_ID_REGEX, 'ID inválido: deve ser um ObjectId válido');

/**
 * Status de catálogo
 */
const catalogStatusSchema = z.enum(['Ativo', 'Inativo'], {
  errorMap: () => ({ message: 'Status inválido (permitidos: Ativo, Inativo)' })
});

// ============================================================================
// Schema de Criação de Debtor (POST /api/debtors)
// ============================================================================

export const createDebtorSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo (máximo 100 caracteres)')
    .trim(),
  
  status: catalogStatusSchema.optional(),
  
  active: z.boolean().default(true),
})
.strict();

// ============================================================================
// Schema de Atualização de Debtor (PUT /api/debtors/:id)
// ============================================================================

export const updateDebtorSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo (máximo 100 caracteres)')
    .trim()
    .optional(),
  
  status: catalogStatusSchema.optional(),
  
  active: z.boolean().optional(),
})
.strict();

// ============================================================================
// Schema de Query/Filtros (GET /api/debtors)
// ============================================================================

export const queryDebtorSchema = z.object({
  active: z.enum(['true', 'false']).optional()
    .transform(val => val === 'true'),
  
  status: catalogStatusSchema.optional(),
  
  // Busca por nome (case-insensitive, partial match)
  search: z.string()
    .max(100, 'Termo de busca muito longo')
    .optional(),
  
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

export type CreateDebtorInput = z.infer<typeof createDebtorSchema>;
export type UpdateDebtorInput = z.infer<typeof updateDebtorSchema>;
export type QueryDebtorInput = z.infer<typeof queryDebtorSchema>;
export type IdParamInput = z.infer<typeof idParamSchema>;
