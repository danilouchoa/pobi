export type ExpenseListKeyArgs = {
  userId: string;
  month: string;
  mode?: "calendar" | "billing";
  page?: number;
  limit?: number;
};

export type ExpenseMonthKeyArgs = {
  userId: string;
  month: string;
  mode?: "calendar" | "billing";
};

// Expense keys follow a stable shape for predicates across variants (mode/page/limit):
// ['expenses', 'list', { month, mode, page, limit }]
// ['expenses', 'month', { month, mode }]
export const expensesKeys = {
  all: ["expenses"] as const,
  byUser: (userId: string) => [...expensesKeys.all, userId] as const,
  list: ({ userId, month, mode = "calendar", page = 1, limit = 20 }: ExpenseListKeyArgs) =>
    [...expensesKeys.all, userId, "list", { month, mode, page, limit }] as const,
  month: ({ userId, month, mode = "calendar" }: ExpenseMonthKeyArgs) =>
    [...expensesKeys.all, userId, "month", { month, mode }] as const,
  recurring: (userId: string) => [...expensesKeys.all, userId, "recurring"] as const,
  shared: (userId: string) => [...expensesKeys.all, userId, "shared"] as const,
  summary: ({ userId, month, mode = "calendar" }: ExpenseMonthKeyArgs) =>
    [...expensesKeys.all, userId, "summary", { month, mode }] as const,
};

export const catalogKeys = {
  all: ["catalogs"] as const,
  byUser: (userId: string) => [...catalogKeys.all, userId] as const,
  origins: (userId: string) => [...catalogKeys.all, userId, "origins"] as const,
  debtors: (userId: string) => [...catalogKeys.all, userId, "debtors"] as const,
};

export const salaryKeys = {
  all: ["salary"] as const,
  allForUser: (userId: string) => [...salaryKeys.all, userId] as const,
  month: (userId: string, month: string) => [...salaryKeys.all, userId, "month", { month }] as const,
};
