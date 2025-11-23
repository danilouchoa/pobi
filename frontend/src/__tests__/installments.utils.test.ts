import { describe, expect, it } from "vitest";
import { validateInstallmentGroup } from "../utils/installments";
import type { Expense } from "../types";

const buildExpense = (overrides: Partial<Expense>): Expense => ({
  id: overrides.id ?? "exp",
  description: "Teste",
  category: "Outros",
  parcela: "1/1",
  amount: 10,
  date: "2025-01-01",
  originId: null,
  debtorId: null,
  recurring: false,
  fixed: false,
  installments: null,
  sharedWith: null,
  sharedAmount: null,
  billingMonth: null,
  installmentGroupId: overrides.installmentGroupId ?? null,
  ...overrides,
});

describe("validateInstallmentGroup", () => {
  it("retorna true quando todas as parcelas possuem o mesmo groupId", () => {
    const result = validateInstallmentGroup([
      buildExpense({ id: "1", installmentGroupId: "grp-1" }),
      buildExpense({ id: "2", installmentGroupId: "grp-1" }),
    ]);
    expect(result.isValid).toBe(true);
    expect(result.groupId).toBe("grp-1");
  });

  it("retorna false quando existir groupId diferente", () => {
    const result = validateInstallmentGroup([
      buildExpense({ id: "1", installmentGroupId: "grp-1" }),
      buildExpense({ id: "2", installmentGroupId: "grp-2" }),
    ]);
    expect(result.isValid).toBe(false);
    expect(result.groupId).toBe("grp-1");
  });

  it("retorna verdadeiro para lista vazia", () => {
    const result = validateInstallmentGroup([]);
    expect(result.isValid).toBe(true);
    expect(result.groupId).toBeNull();
  });
});
