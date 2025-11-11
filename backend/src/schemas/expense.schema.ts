/**
 * Schemas de Validação - Expense (Despesas)
 * 
 * Propósito:
 * - Validar entrada de dados para criação, atualização e consulta de despesas
 * - Garantir integridade de valores monetários (string com 2 casas decimais)
 * - Validar datas, IDs de relacionamento e campos de recorrência
 * - Rejeitar campos desconhecidos para reduzir superfície de ataque
 * 
 * Uso:
 * - POST /api/expenses (createExpenseSchema)
 * - PUT /api/expenses/:id (updateExpenseSchema)
 * - GET /api/expenses (queryExpenseSchema)
 * - DELETE /api/expenses/:id (idParamSchema)
 * 
 * Regras de Negócio:
 * - Valores monetários: string no formato "0.00" (evita perda de precisão com float)
 * - Datas: ISO 8601 ou Date object, coerção automática
 * - IDs: MongoDB ObjectId hex string (24 caracteres)
 * - Parcela: formato livre (ex: "Único", "1/12", "Mensal")
 * - Recurring: boolean que determina se será replicada mensalmente
 * - Fixed: boolean que indica se o valor é fixo ou variável
 * 
 * Decisões de Design:
 * - .strict() em todos os schemas para rejeitar campos extras
 * - Coerção de datas via z.coerce.date() para aceitar strings ISO
 * - Validação de ObjectId via regex (24 caracteres hexadecimais)
 * - Mensagens de erro em português para usuários finais
 * - Campos opcionais com .optional() ao invés de .nullable()
 */

import { z } from 'zod';

// ============================================================================
// Helpers Compartilhados
// ============================================================================

/**
 * Regex para validar MongoDB ObjectId (24 caracteres hexadecimais)
 */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Validador de ObjectId MongoDB
 */
const objectIdSchema = z.string()
  .regex(OBJECT_ID_REGEX, 'ID inválido: deve ser um ObjectId válido (24 caracteres hexadecimais)');

/**
 * Validador de valor monetário (string com 2 casas decimais)
 * Aceita formatos: "100.00", "1234.56", "0.99"
 * Rejeita: números, floats, strings sem casas decimais
 */
const monetaryValueSchema = z.string()
  .regex(/^\d+\.\d{2}$/, 'Valor monetário deve estar no formato "0.00" (string com 2 casas decimais)')
  .refine(
    (val) => parseFloat(val) >= 0,
    'Valor monetário não pode ser negativo'
  );

/**
 * Validador de parcela (formato livre, mas não vazio)
 * Exemplos válidos: "Único", "1/12", "Mensal", "2/6"
 */
const parcelaSchema = z.string()
  .min(1, 'Parcela não pode estar vazia')
  .max(50, 'Parcela muito longa (máximo 50 caracteres)');

/**
 * Tipos de recorrência permitidos
 */
const recurrenceTypeSchema = z.enum(['monthly', 'yearly', 'custom'], {
  errorMap: () => ({ message: 'Tipo de recorrência inválido (permitidos: monthly, yearly, custom)' })
});

// ============================================================================
// Schema de Criação de Despesa (POST /api/expenses)
// ============================================================================

export const createExpenseSchema = z.object({
  date: z.coerce.date({
    errorMap: () => ({ message: 'Data inválida: deve ser uma data válida (ISO 8601)' })
  }),
  description: z.string()
    .min(1, 'Descrição é obrigatória')
    .max(200, 'Descrição muito longa (máximo 200 caracteres)'),
  category: z.string()
    .min(1, 'Categoria é obrigatória')
    .max(100, 'Categoria muito longa (máximo 100 caracteres)'),
  parcela: parcelaSchema,
  amount: monetaryValueSchema,
  
  // Relacionamentos opcionais
  originId: objectIdSchema.optional(),
  debtorId: objectIdSchema.optional(),
  
  // Campos de recorrência
  recurring: z.boolean().default(false),
  recurrenceType: recurrenceTypeSchema.optional(),
  fixed: z.boolean().default(false),
  installments: z.number()
    .int('Número de parcelas deve ser inteiro')
    .min(1, 'Número de parcelas deve ser maior que 0')
    .max(120, 'Número de parcelas não pode exceder 120')
    .optional(),
  
  // Campos de compartilhamento
  sharedWith: z.string()
    .max(100, 'Nome de compartilhamento muito longo (máximo 100 caracteres)')
    .optional(),
  sharedAmount: monetaryValueSchema.optional(),
  
  // billingMonth é calculado automaticamente pelo backend
  // não deve ser enviado pelo cliente
}).strict(); // Rejeita campos extras

export const createExpenseBatchSchema = z.array(createExpenseSchema).min(1, 'Informe ao menos uma despesa').max(200, 'Limite de 200 despesas por lote');

// ============================================================================
// Schema de Atualização de Despesa (PUT /api/expenses/:id)
// ============================================================================

/**
 * Atualização permite campos opcionais (partial)
 * Mas mantém as mesmas regras de validação quando presentes
 */
export const updateExpenseSchema = createExpenseSchema.partial().strict();

// ============================================================================
// Schema de Query/Filtros (GET /api/expenses)
// ============================================================================

export const queryExpenseSchema = z.object({
  // Filtros de data - aceita formato YYYY-MM (billing) OU year+month separados (calendar)
  month: z.string().optional(), // Aceita tanto "YYYY-MM" quanto "11" (número do mês)
  year: z.string()
    .regex(/^\d{4}$/, 'Ano deve ter 4 dígitos')
    .optional(), // Para mode=calendar
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  
  // Filtros de relacionamento
  originId: objectIdSchema.optional(),
  debtorId: objectIdSchema.optional(),
  category: z.string().optional(),
  
  // Filtros booleanos
  recurring: z.enum(['true', 'false']).optional()
    .transform(val => val === 'true'), // Converte string para boolean
  fixed: z.enum(['true', 'false']).optional()
    .transform(val => val === 'true'),
  
  // Modo de visualização (calendar = por data transação, billing = por fatura, transaction = compatibilidade)
  mode: z.enum(['calendar', 'billing', 'transaction'], {
    errorMap: () => ({ message: 'Modo inválido (permitidos: calendar, billing, transaction)' })
  }).optional(),
  
  // Mês de faturamento (para mode=billing) - compatibilidade
  billingMonth: z.string()
    .regex(/^\d{4}-\d{2}$/, 'billingMonth deve estar no formato YYYY-MM')
    .optional(),
  
  // Paginação
  page: z.coerce.number()
    .int('Página deve ser um número inteiro')
    .min(1, 'Página deve ser maior que 0')
    .optional(),
  limit: z.coerce.number()
    .int('Limit deve ser um número inteiro')
    .min(1, 'Limit deve ser maior que 0')
    .max(1000, 'Limit não pode exceder 1000') // Aumentado para aceitar 1000 do frontend
    .optional(),
}).strict();

// ============================================================================
// Schema de Parâmetros de Rota (DELETE/PUT /api/expenses/:id)
// ============================================================================

export const idParamSchema = z.object({
  id: objectIdSchema
}).strict();

// ============================================================================
// Tipos TypeScript Inferidos (para uso no código)
// ============================================================================

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type QueryExpenseInput = z.infer<typeof queryExpenseSchema>;
export type IdParamInput = z.infer<typeof idParamSchema>;
