import { z } from "zod";

const nullableString = z.union([z.string(), z.null(), z.undefined()]);
const nullableNumber = z.union([z.number(), z.null(), z.undefined()]);
const billingPolicySchema = z
  .union([
    z.literal("NEXT"),
    z.literal("PREVIOUS"),
    z.null(),
    z.undefined(),
  ])
  .transform((value) => value ?? null);

export const ExpenseSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.string(),
  parcela: nullableString.transform((value) => value ?? ""),
  amount: z.number(),
  date: z.string(),
  originId: nullableString.transform((value) => value ?? null),
  debtorId: nullableString.transform((value) => value ?? null),
  recurring: z.boolean().optional(),
  recurrenceType: z
    .union([
      z.literal("monthly"),
      z.literal("weekly"),
      z.literal("yearly"),
      z.null(),
      z.undefined(),
    ])
    .transform((value) => value ?? null),
  fixed: z.boolean().optional(),
  installments: nullableNumber.transform((value) => value ?? null),
  sharedWith: nullableString.transform((value) => value ?? null),
  sharedAmount: nullableNumber.transform((value) => value ?? null),
  billingMonth: nullableString.transform((value) => value ?? null),
});

export const ExpensesSchema = z.array(ExpenseSchema);

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

export const ExpensesResponseSchema = z.object({
  data: ExpensesSchema,
  pagination: PaginationSchema,
});

export const OriginSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  dueDay: nullableString.transform((value) => value ?? null),
  limit: nullableNumber.transform((value) => value ?? null),
  status: nullableString.transform((value) => value ?? null),
  active: z.boolean().optional(),
  closingDay: nullableNumber.transform((value) => value ?? null),
  billingRolloverPolicy: billingPolicySchema,
});

export const OriginsSchema = z.array(OriginSchema);

export const DebtorSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: nullableString.transform((value) => value ?? null),
  active: z.boolean().optional(),
});

export const DebtorsSchema = z.array(DebtorSchema);

export const SalaryRecordSchema = z.object({
  id: z.string(),
  month: z.string(),
  hours: z.number(),
  hourRate: z.number(),
  taxRate: z.number(),
  cnae: nullableString.transform((value) => value ?? null),
});

export const SalaryRecordsSchema = z.array(SalaryRecordSchema);
