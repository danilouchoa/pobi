/**
 * Schemas de Validação - Origin (Origens de Pagamento)
 * 
 * Propósito:
 * - Validar criação e atualização de origens (Cartões de Crédito e Contas)
 * - Garantir integridade de dados específicos de cartão (closingDay, billingRolloverPolicy)
 * - Validar limites monetários e tipos permitidos
 * - Prevenir inconsistências em configurações de faturamento
 * 
 * Uso:
 * - POST /api/origins (createOriginSchema)
 * - PUT /api/origins/:id (updateOriginSchema)
 * - GET /api/origins (queryOriginSchema)
 * - DELETE /api/origins/:id (idParamSchema)
 * 
 * Regras de Negócio:
 * - Tipo: enum ["Cartão", "Conta", "Dinheiro"]
 * - closingDay: obrigatório para type="Cartão", opcional para outros (1-31)
 * - billingRolloverPolicy: NEXT (segunda-feira) ou PREVIOUS (sexta-feira)
 * - dueDay: string livre (ex: "N/A", "10", "Todo dia 15")
 * - limit: string monetária com 2 casas decimais
 * - status: enum ["Ativo", "Inativo", "Bloqueado"]
 * 
 * Decisões de Design:
 * - Validação condicional: closingDay só é validado para Cartões
 * - billingRolloverPolicy default é PREVIOUS (padrão bancário brasileiro)
 * - Nome mínimo 3 caracteres para evitar abreviações confusas
 * - Status é opcional (default "Ativo" no backend)
 * - .strict() para rejeitar campos desconhecidos
 */

import { z } from 'zod';

// ============================================================================
// Helpers Compartilhados
// ============================================================================

/**
 * Regex para MongoDB ObjectId
 */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = z.string()
  .regex(OBJECT_ID_REGEX, 'ID inválido: deve ser um ObjectId válido');

/**
 * Validador de valor monetário
 */
const monetaryValueSchema = z.preprocess((val) => {
  if (typeof val === 'number') {
    return val.toFixed(2);
  }
  if (typeof val === 'string') {
    if (/^\d+$/.test(val)) return `${val}.00`;
    return val;
  }
  return val;
}, z.string()
  .regex(/^\d+\.\d{2}$/, 'Limite deve estar no formato "0.00"')
  .refine(
    (val) => parseFloat(val) > 0,
    'Limite deve ser maior que zero'
  ));

// ============================================================================
// Enums e Tipos Permitidos
// ============================================================================

/**
 * Tipos de origem permitidos
 */
const originTypeSchema = z.enum(['Cartão', 'Conta', 'Dinheiro'], {
  errorMap: () => ({ message: 'Tipo inválido (permitidos: Cartão, Conta, Dinheiro)' })
});

/**
 * Política de rollover para fechamento em fim de semana
 * - NEXT: Adiar para segunda-feira (compras do FDS entram na fatura atual)
 * - PREVIOUS: Antecipar para sexta-feira (compras do FDS vão para próxima fatura)
 */
const billingRolloverPolicySchema = z.enum(['NEXT', 'PREVIOUS'], {
  errorMap: () => ({ message: 'Política de rollover inválida (permitidos: NEXT, PREVIOUS)' })
});

/**
 * Status da origem
 */
const originStatusSchema = z.enum(['Ativo', 'Inativo', 'Bloqueado'], {
  errorMap: () => ({ message: 'Status inválido (permitidos: Ativo, Inativo, Bloqueado)' })
});

// ============================================================================
// Schema de Criação de Origin (POST /api/origins)
// ============================================================================

export const createOriginSchema = z.object({
  name: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo (máximo 100 caracteres)'),
  
  type: originTypeSchema,
  
  dueDay: z.string()
    .max(50, 'Dia de vencimento muito longo (máximo 50 caracteres)')
    .optional(),
  
  limit: monetaryValueSchema.optional(),
  
  status: originStatusSchema.optional(),
  
  active: z.boolean().default(true),
  
  // Campos específicos para Cartão de Crédito
  closingDay: z.number()
    .int('Dia de fechamento deve ser um número inteiro')
    .min(1, 'Dia de fechamento deve estar entre 1 e 31')
    .max(31, 'Dia de fechamento deve estar entre 1 e 31')
    .optional(),
  
  billingRolloverPolicy: billingRolloverPolicySchema.optional(),
})
.strict()
.refine(
  // Validação condicional: se type="Cartão", closingDay é obrigatório
  (data) => {
    if (data.type === 'Cartão' && !data.closingDay) {
      return false;
    }
    return true;
  },
  {
    message: 'closingDay é obrigatório para origens do tipo "Cartão"',
    path: ['closingDay'] // Aponta o erro para o campo específico
  }
)
.refine(
  // Validação condicional: se não é Cartão, closingDay não deve ser enviado
  (data) => {
    if (data.type !== 'Cartão' && data.closingDay !== undefined) {
      return false;
    }
    return true;
  },
  {
    message: 'closingDay só pode ser definido para origens do tipo "Cartão"',
    path: ['closingDay']
  }
);

// ============================================================================
// Schema de Atualização de Origin (PUT /api/origins/:id)
// ============================================================================

/**
 * Atualização permite campos opcionais
 * Mas mantém as mesmas regras quando presentes
 * Validações condicionais só se aplicam se ambos os campos estiverem presentes
 */
export const updateOriginSchema = z.object({
  name: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo (máximo 100 caracteres)')
    .optional(),
  
  type: originTypeSchema.optional(),
  
  dueDay: z.string()
    .max(50, 'Dia de vencimento muito longo')
    .optional(),
  
  limit: monetaryValueSchema.optional(),
  
  status: originStatusSchema.optional(),
  
  active: z.boolean().optional(),
  
  closingDay: z.number()
    .int('Dia de fechamento deve ser um número inteiro')
    .min(1, 'Dia de fechamento deve estar entre 1 e 31')
    .max(31, 'Dia de fechamento deve estar entre 1 e 31')
    .optional(),
  
  billingRolloverPolicy: billingRolloverPolicySchema.optional(),
})
.strict();
// Nota: validação condicional type+closingDay não é aplicada em updates
// porque o frontend pode enviar apenas um dos campos
// A validação completa deve ser feita no service layer

// ============================================================================
// Schema de Query/Filtros (GET /api/origins)
// ============================================================================

export const queryOriginSchema = z.object({
  type: originTypeSchema.optional(),
  
  active: z.enum(['true', 'false']).optional()
    .transform(val => val === 'true'),
  
  status: originStatusSchema.optional(),
  
  // Paginação (se necessário no futuro)
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

export type CreateOriginInput = z.infer<typeof createOriginSchema>;
export type UpdateOriginInput = z.infer<typeof updateOriginSchema>;
export type QueryOriginInput = z.infer<typeof queryOriginSchema>;
export type IdParamInput = z.infer<typeof idParamSchema>;
