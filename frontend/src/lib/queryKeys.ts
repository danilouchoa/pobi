export type ExpenseListKeyArgs = {
  month: string;
  mode?: "calendar" | "billing";
  page?: number;
  limit?: number;
};

export type ExpenseMonthKeyArgs = {
  month: string;
  mode?: "calendar" | "billing";
};

// Expense keys follow a stable shape for predicates across variants (mode/page/limit):
// ['expenses', 'list', { month, mode, page, limit }]
// ['expenses', 'month', { month, mode }]
export const expensesKeys = {
  all: ["expenses"] as const,
  list: ({ month, mode = "calendar", page = 1, limit = 20 }: ExpenseListKeyArgs) =>
    [...expensesKeys.all, "list", { month, mode, page, limit }] as const,
  month: ({ month, mode = "calendar" }: ExpenseMonthKeyArgs) =>
    [...expensesKeys.all, "month", { month, mode }] as const,
  recurring: () => [...expensesKeys.all, "recurring"] as const,
  shared: () => [...expensesKeys.all, "shared"] as const,
  summary: ({ month, mode = "calendar" }: ExpenseMonthKeyArgs) =>
    [...expensesKeys.all, "summary", { month, mode }] as const,
};

export const catalogKeys = {
  all: ["catalogs"] as const,
  origins: () => [...catalogKeys.all, "origins"] as const,
  debtors: () => [...catalogKeys.all, "debtors"] as const,
};

export const salaryKeys = {
  all: ["salary"] as const,
  month: (month: string) => [...salaryKeys.all, "month", { month }] as const,
};
