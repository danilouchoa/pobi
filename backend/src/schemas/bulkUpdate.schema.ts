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
