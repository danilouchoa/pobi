import { z } from 'zod';

const recurrenceSchema = z.enum(['monthly', 'weekly', 'yearly']);

export const bulkUpdateSchema = z.object({
  expenseIds: z.array(z.string()).min(1, 'Selecione pelo menos um lançamento.'),
  data: z
    .object({
      category: z.string().min(1).optional(),
      originId: z.string().min(1).optional(),
      fixed: z.boolean().optional(),
      recurring: z.boolean().optional(),
      recurrenceType: recurrenceSchema.nullable().optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, {
      message: 'Informe pelo menos um campo para atualização.',
    }),
});

export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
