import { useCallback, useEffect, useMemo, useState } from "react";
import type { Expense } from "../types";

type UseSelectedInstallmentsReturn = {
  selectedIds: Set<string>;
  selectedCount: number;
  selectedExpenses: Expense[];
  isAllSelected: boolean;
  toggleSelection: (id: string, checked: boolean) => void;
  toggleAllVisible: (checked: boolean) => void;
  clearSelection: () => void;
};

export function useSelectedInstallments(expenses: Expense[]): UseSelectedInstallmentsReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      expenses.forEach((expense) => {
        if (prev.has(expense.id)) {
          next.add(expense.id);
        }
      });
      return next;
    });
  }, [expenses]);

  const toggleSelection = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        if (!checked) {
          const next = new Set(prev);
          expenses.forEach((expense) => next.delete(expense.id));
          return next;
        }
        const next = new Set(prev);
        expenses.forEach((expense) => next.add(expense.id));
        return next;
      });
    },
    [expenses]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedExpenses = useMemo(() => expenses.filter((expense) => selectedIds.has(expense.id)), [expenses, selectedIds]);
  const selectedCount = selectedIds.size;
  const isAllSelected = expenses.length > 0 && expenses.every((expense) => selectedIds.has(expense.id));

  return {
    selectedIds,
    selectedCount,
    selectedExpenses,
    isAllSelected,
    toggleSelection,
    toggleAllVisible,
    clearSelection,
  };
}
