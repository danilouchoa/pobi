export const expensesKeys = {
  all: ["expenses"] as const,
  list: (
    month: string,
    mode: "calendar" | "billing",
    page: number,
    limit: number
  ) => [...expensesKeys.all, { month, mode, page, limit }] as const,
  month: (month: string, mode: "calendar" | "billing" = "calendar") =>
    [...expensesKeys.all, { month, mode }] as const,
  recurring: ["expenses", "recurring"] as const,
  shared: ["expenses", "shared"] as const,
};

export const catalogKeys = {
  origins: ["catalogs", "origins"] as const,
  debtors: ["catalogs", "debtors"] as const,
};

export const salaryKeys = {
  all: ["salary"] as const,
  month: (month: string) => [...salaryKeys.all, { month }] as const,
};
