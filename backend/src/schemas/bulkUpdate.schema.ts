import { z } from 'zod';

const recurrenceSchema = z.enum(['monthly', 'weekly', 'yearly']);

export const bulkUpdateDataSchema = z
  .object({
    category: z.string().min(1).optional(),
    fixed: z.boolean().optional(),
    recurring: z.boolean().optional(),
    recurrenceType: recurrenceSchema.nullable().optional(),
    originId: z.string().min(1).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe pelo menos um campo para atualização.',
  });

const filtersSchema = z
  .object({
    expenseIds: z.array(z.string()).min(1).optional(),
  })
  .refine((value) => Boolean(value.expenseIds && value.expenseIds.length > 0), {
    message: 'Selecione ao menos um critério de filtro.',
  });

const optionsSchema = z.object({
  mode: z.enum(['calendar', 'billing']).default('calendar'),
  invalidate: z.boolean().default(true),
});

export const bulkJobSchema = z.object({
  filters: filtersSchema,
  data: bulkUpdateDataSchema,
  options: optionsSchema.default({ mode: 'calendar', invalidate: true }),
});

export type BulkUpdateData = z.infer<typeof bulkUpdateDataSchema>;
export type BulkJobPayload = z.infer<typeof bulkJobSchema>;

// ------------------------------
// Novo schema unificado para /api/expenses/bulk (update | delete)
// ------------------------------

// Item individual de atualização (permite campos parciais diferentes por id)
const bulkUpdateItemSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1).optional(),
  fixed: z.boolean().optional(),
  recurring: z.boolean().optional(),
  recurrenceType: recurrenceSchema.nullable().optional(),
  originId: z.string().min(1).optional(),
});

export const bulkUnifiedUpdateSchema = z.object({
  action: z.literal('update'),
  items: z.array(bulkUpdateItemSchema).min(1),
});

export const bulkUnifiedDeleteSchema = z.object({
  action: z.literal('delete'),
  ids: z.array(z.string().min(1)).min(1),
});

// Discriminated union pelo campo action
export const bulkUnifiedActionSchema = z.discriminatedUnion('action', [
  bulkUnifiedUpdateSchema,
  bulkUnifiedDeleteSchema,
]);

export type BulkUnifiedDeletePayload = z.infer<typeof bulkUnifiedDeleteSchema>;
export type BulkUnifiedUpdateItem = z.infer<typeof bulkUpdateItemSchema>;
export type BulkUnifiedUpdatePayload = z.infer<typeof bulkUnifiedUpdateSchema>;
export type BulkUnifiedActionPayload = z.infer<typeof bulkUnifiedActionSchema>;
