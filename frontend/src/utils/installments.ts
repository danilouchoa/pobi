import type { Expense } from "../types";

export type InstallmentGroupValidation = {
  isValid: boolean;
  groupId: string | null;
};

export const validateInstallmentGroup = (expenses: Expense[]): InstallmentGroupValidation => {
  if (!expenses.length) {
    return { isValid: true, groupId: null };
  }
  const normalized = expenses.map((expense) => expense.installmentGroupId ?? null);
  const unique = new Set(normalized);
  return {
    isValid: unique.size <= 1,
    groupId: normalized[0] ?? null,
  };
};
