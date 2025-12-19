import { z } from 'zod';

const displaySchema = z
  .object({
    compactMode: z.boolean().optional(),
    dateFormat: z.string().trim().max(32).optional(),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
  })
  .catchall(z.unknown());

export const onboardingPatchSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === 'string' && val.trim().length === 0 ? undefined : val),
    z.string().trim().min(1).max(120).optional(),
  ),
  avatar: z.string().trim().url().optional(),
  countryCode: z.string().trim().max(3).optional(),
  currencyCode: z.string().trim().max(5).optional(),
  timezone: z.string().trim().max(120).optional(),
  display: displaySchema.optional(),
  goals: z.array(z.string().trim().min(1)).optional(),
  markStepCompleted: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export type OnboardingPatchInput = z.infer<typeof onboardingPatchSchema>;
