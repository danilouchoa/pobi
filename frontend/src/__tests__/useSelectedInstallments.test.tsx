import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSelectedInstallments } from "../hooks/useSelectedInstallments";
import type { Expense } from "../types";

const sampleExpenses: Expense[] = [
  {
    id: "exp-1",
    description: "Compra 1",
    category: "Outros",
    parcela: "1/2",
    amount: 10,
    date: "2025-01-01",
    originId: null,
    debtorId: null,
    recurring: false,
    fixed: false,
    installments: 2,
    sharedWith: null,
    sharedAmount: null,
    billingMonth: null,
    installmentGroupId: "grp-1",
  },
  {
    id: "exp-2",
    description: "Compra 2",
    category: "Outros",
    parcela: "2/2",
    amount: 10,
    date: "2025-02-01",
    originId: null,
    debtorId: null,
    recurring: false,
    fixed: false,
    installments: 2,
    sharedWith: null,
    sharedAmount: null,
    billingMonth: null,
    installmentGroupId: "grp-1",
  },
];

describe("useSelectedInstallments", () => {
  it("seleciona uma única parcela", () => {
    const { result } = renderHook(() => useSelectedInstallments(sampleExpenses));

    act(() => result.current.toggleSelection("exp-1", true));

    expect(result.current.selectedCount).toBe(1);
    expect(Array.from(result.current.selectedIds)).toEqual(["exp-1"]);
    expect(result.current.selectedExpenses).toHaveLength(1);
  });

  it("seleciona múltiplas parcelas", () => {
    const { result } = renderHook(() => useSelectedInstallments(sampleExpenses));

    act(() => {
      result.current.toggleSelection("exp-1", true);
      result.current.toggleSelection("exp-2", true);
    });

    expect(result.current.selectedCount).toBe(2);
    expect(Array.from(result.current.selectedIds)).toEqual(["exp-1", "exp-2"]);
  });

  it("desmarca uma parcela", () => {
    const { result } = renderHook(() => useSelectedInstallments(sampleExpenses));

    act(() => {
      result.current.toggleSelection("exp-1", true);
      result.current.toggleSelection("exp-2", true);
    });
    act(() => result.current.toggleSelection("exp-2", false));

    expect(result.current.selectedCount).toBe(1);
    expect(Array.from(result.current.selectedIds)).toEqual(["exp-1"]);
  });

  it("limpa a seleção", () => {
    const { result } = renderHook(() => useSelectedInstallments(sampleExpenses));

    act(() => {
      result.current.toggleSelection("exp-1", true);
      result.current.toggleSelection("exp-2", true);
    });
    act(() => result.current.clearSelection());

    expect(result.current.selectedCount).toBe(0);
    expect(Array.from(result.current.selectedIds)).toEqual([]);
    expect(result.current.selectedExpenses).toHaveLength(0);
  });

  it("exponibiliza todas as funções públicas", () => {
    const { result } = renderHook(() => useSelectedInstallments(sampleExpenses));

    expect(typeof result.current.toggleSelection).toBe("function");
    expect(typeof result.current.toggleAllVisible).toBe("function");
    expect(typeof result.current.clearSelection).toBe("function");
  });

  it("seleciona e limpa todas as parcelas visíveis com toggleAllVisible", () => {
    const { result } = renderHook(() => useSelectedInstallments(sampleExpenses));

    act(() => result.current.toggleAllVisible(true));
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectedCount).toBe(sampleExpenses.length);

    act(() => result.current.toggleAllVisible(false));
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.selectedCount).toBe(0);
    expect(Array.from(result.current.selectedIds)).toEqual([]);
  });
});
