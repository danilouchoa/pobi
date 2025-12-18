import { useCallback, useMemo, useState } from "react";
import { useExpenses } from "./useExpenses";
import { useCatalogs } from "./useCatalogs";
import { useSalary } from "./useSalary";
import { readLS, saveLS, parseNum } from "../utils/helpers";
import { useAuth } from "../context/useAuth";
import { ExpensePayload, OriginPayload, DebtorPayload } from "../types";
import { useCategories } from "./useCategories";

const MONTH_STORAGE_KEY = "pf-month";

const normalizeClosingDay = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const DEFAULT_SALARY_TEMPLATE = {
  hours: "178",
  hourRate: "95.24",
  taxRate: "0.06",
  cnae: "Suporte e manutenção de computadores",
  month: new Date().toISOString().slice(0, 7),
};

export function useFinanceApp() {
  const { token, user } = useAuth();
  const [month, setMonthState] = useState(() =>
    readLS(MONTH_STORAGE_KEY, new Date().toISOString().slice(0, 7))
  );
  const [viewMode, setViewMode] = useState<"calendar" | "billing">("calendar");

  const isEnabled = Boolean(token);

  const expenses = useExpenses(month, {
    enabled: isEnabled,
    mode: viewMode,
    page: 1,
    limit: 1000,
  });
  const catalogs = useCatalogs({ enabled: isEnabled });
  const salary = useSalary(month, { enabled: isEnabled });
  // Garante que categorias customizadas (persistidas localmente) estejam disponíveis globalmente.
  const { categories, addCategory } = useCategories((user as any)?.id);

  const state = useMemo(
    () => ({
      expenses: expenses.expensesQuery.data?.data ?? [],
      origins: catalogs.originsQuery.data ?? [],
      debtors: catalogs.debtorsQuery.data ?? [],
      salaryHistory: salary.recordsMap ?? {},
      recurringExpenses: expenses.recurringQuery.data ?? [],
      sharedExpenses: expenses.sharedQuery.data ?? [],
      categories,
    }),
    [
      expenses.expensesQuery.data,
      catalogs.originsQuery.data,
      catalogs.debtorsQuery.data,
      salary.recordsMap,
      expenses.recurringQuery.data,
      expenses.sharedQuery.data,
      categories,
    ]
  );

  const loading =
    expenses.expensesQuery.isFetching ||
    catalogs.originsQuery.isFetching ||
    catalogs.debtorsQuery.isFetching ||
    salary.salaryQuery.isFetching;

  const error =
    (expenses.expensesQuery.error as Error | undefined)?.message ??
    (catalogs.originsQuery.error as Error | undefined)?.message ??
    (catalogs.debtorsQuery.error as Error | undefined)?.message ??
    (salary.salaryQuery.error as Error | undefined)?.message ??
    null;

  const refresh = useCallback(async () => {
    await Promise.all([
      expenses.expensesQuery.refetch(),
      catalogs.originsQuery.refetch(),
      catalogs.debtorsQuery.refetch(),
      salary.salaryQuery.refetch(),
      expenses.recurringQuery.refetch(),
      expenses.sharedQuery.refetch(),
    ]);
  }, [
    expenses.expensesQuery,
    catalogs.originsQuery,
    catalogs.debtorsQuery,
    salary.salaryQuery,
    expenses.recurringQuery,
    expenses.sharedQuery,
  ]);

  const setMonth = useCallback((value: string) => {
    setMonthState(value);
    saveLS(MONTH_STORAGE_KEY, value);
  }, []);

  const createExpense = useCallback(
    async (payload: ExpensePayload) => {
      await expenses.createExpense({
        ...payload,
        amount: parseNum(payload.amount),
        debtorId: payload.debtorId || null,
      });
    },
    [expenses]
  );

  const createExpenseBatch = useCallback(
    async (payloads: ExpensePayload[]) => {
      if (!payloads.length) return;
      const normalized = payloads.map((payload) => ({
        ...payload,
        amount: parseNum(payload.amount),
        debtorId: payload.debtorId || null,
      }));
      await expenses.createExpenseBatch(normalized);
    },
    [expenses]
  );

  const adjustExpense = useCallback(
    async (id: string, payload: ExpensePayload) => {
      await expenses.updateExpense(id, {
        ...payload,
        amount: parseNum(payload.amount),
        debtorId: payload.debtorId || null,
      });
    },
    [expenses]
  );

  const createRecurringExpense = useCallback(
    async (payload: ExpensePayload) => {
      await expenses.createRecurringExpense({
        ...payload,
        amount: parseNum(payload.amount),
      });
    },
    [expenses]
  );

  const createOrigin = useCallback(
    async (payload: OriginPayload) => {
      const limit =
        payload.limit === undefined || payload.limit === null
          ? null
          : Number(payload.limit);
      await catalogs.createOrigin({
        ...payload,
        limit: Number.isNaN(limit as number) ? null : limit,
        closingDay: normalizeClosingDay(payload.closingDay),
        billingRolloverPolicy: payload.billingRolloverPolicy ?? null,
      });
    },
    [catalogs]
  );

  const updateOrigin = useCallback(
    async (id: string, payload: OriginPayload) => {
      const limit =
        payload.limit === undefined || payload.limit === null
          ? null
          : Number(payload.limit);
      await catalogs.updateOrigin(id, {
        ...payload,
        limit: Number.isNaN(limit as number) ? null : limit,
        closingDay: normalizeClosingDay(payload.closingDay),
        billingRolloverPolicy: payload.billingRolloverPolicy ?? null,
      });
    },
    [catalogs]
  );

  const createDebtor = useCallback(
    async (payload: DebtorPayload) => {
      await catalogs.createDebtor(payload);
    },
    [catalogs]
  );

  const updateDebtor = useCallback(
    async (id: string, payload: DebtorPayload) => {
      await catalogs.updateDebtor(id, payload);
    },
    [catalogs]
  );

  const saveSalaryForMonth = useCallback(
    async (targetMonth: string, payload: { hours: string; hourRate: string; taxRate: string; cnae?: string | null }) => {
      const normalized = {
        hours: parseNum(payload.hours),
        hourRate: parseNum(payload.hourRate),
        taxRate: parseNum(payload.taxRate),
        cnae: payload.cnae,
      };
      if (
        Number.isNaN(normalized.hours) ||
        Number.isNaN(normalized.hourRate) ||
        Number.isNaN(normalized.taxRate)
      ) {
        throw new Error("Horas, valor hora e alíquota precisam ser numéricos.");
      }
      await salary.saveSalary(targetMonth, normalized);
    },
    [salary]
  );

  return {
    state,
    month,
    setMonth,
    viewMode,
    setViewMode,
    loading,
    error,
    refresh,
    createExpense,
  createExpenseBatch,
    deleteExpense: expenses.deleteExpense,
    duplicateExpense: expenses.duplicateExpense,
    adjustExpense,
    createOrigin,
    deleteOrigin: catalogs.deleteOrigin,
    updateOrigin,
    createDebtor,
    deleteDebtor: catalogs.deleteDebtor,
    updateDebtor,
    saveSalaryForMonth,
    createRecurringExpense,
    fetchRecurringExpenses: expenses.fetchRecurringExpenses,
    fetchSharedExpenses: expenses.fetchSharedExpenses,
    // Expondo categories/addCategory para que as telas de Cadastros e Lançamentos compartilhem o mesmo estado.
    categories,
    addCategory,
  };
}
