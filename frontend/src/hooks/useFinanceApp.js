import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { readLS, saveLS, parseNum } from "../utils/helpers";
import { useAuth } from "../context/AuthProvider";

export const DEFAULT_SALARY_TEMPLATE = {
  hours: "178",
  hourRate: "95.24",
  taxRate: "0.06",
  cnae: "Suporte e manutenção de computadores",
  month: new Date().toISOString().slice(0, 7),
};

const INITIAL_STATE = {
  expenses: [],
  salaryHistory: {},
  debtors: [],
  origins: [],
};

const MONTH_STORAGE_KEY = "pf-month";

const mapSalaryRecords = (records) =>
  records.reduce((acc, record) => {
    acc[record.month] = {
      ...DEFAULT_SALARY_TEMPLATE,
      ...record,
      hours: String(record.hours ?? DEFAULT_SALARY_TEMPLATE.hours),
      hourRate: String(record.hourRate ?? DEFAULT_SALARY_TEMPLATE.hourRate),
      taxRate: String(record.taxRate ?? DEFAULT_SALARY_TEMPLATE.taxRate),
      cnae: record.cnae ?? DEFAULT_SALARY_TEMPLATE.cnae,
    };
    return acc;
  }, {});

export function useFinanceApp() {
  const { token } = useAuth();
  const [state, setState] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(() =>
    readLS(MONTH_STORAGE_KEY, new Date().toISOString().slice(0, 7))
  );

  const saveMonth = useCallback((value) => {
    setMonth(value);
    saveLS(MONTH_STORAGE_KEY, value);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!token) {
      setState(INITIAL_STATE);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const requestConfig = { headers: { "Cache-Control": "no-cache" } };
      const [expensesRes, originsRes, debtorsRes, salaryRes] =
        await Promise.all([
          api.get("/api/expenses", requestConfig),
          api.get("/api/origins", requestConfig),
          api.get("/api/debtors", requestConfig),
          api.get("/api/salaryHistory", requestConfig),
        ]);
      setState((prev) => ({
        expenses: Array.isArray(expensesRes.data)
          ? expensesRes.data
          : prev.expenses,
        origins: Array.isArray(originsRes.data)
          ? originsRes.data
          : prev.origins,
        debtors: Array.isArray(debtorsRes.data)
          ? debtorsRes.data
          : prev.debtors,
        salaryHistory: Array.isArray(salaryRes.data)
          ? mapSalaryRecords(salaryRes.data)
          : prev.salaryHistory,
      }));
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
      const message =
        err.response?.data?.message ?? "Erro ao carregar dados da API.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      console.log("[useFinanceApp] Sem token, limpando estado");
      setState(INITIAL_STATE);
      return;
    }

    console.log("[useFinanceApp] Recarregando dados para o mês:", month);
    fetchAll();
  }, [token, month, fetchAll]);

  const createExpense = useCallback(async (payload) => {
    const body = {
      ...payload,
      amount: parseNum(payload.amount),
      debtorId: payload.debtorId || null,
    };
    const { data } = await api.post("/api/expenses", body);
    setState((current) => ({
      ...current,
      expenses: [data, ...current.expenses],
    }));
    return data;
  }, []);

  const deleteExpense = useCallback(async (id) => {
    await api.delete(`/api/expenses/${id}`);
    setState((current) => ({
      ...current,
      expenses: current.expenses.filter((expense) => expense.id !== id),
    }));
  }, []);

  const createOrigin = useCallback(async (payload) => {
    const parsedLimit = Number(payload.limit);
    const body = {
      ...payload,
      limit:
        payload.limit === "" || Number.isNaN(parsedLimit) ? null : parsedLimit,
    };
    const { data } = await api.post("/api/origins", body);
    setState((current) => ({
      ...current,
      origins: [...current.origins, data],
    }));
    return data;
  }, []);

  const deleteOrigin = useCallback(async (id) => {
    await api.delete(`/api/origins/${id}`);
    setState((current) => ({
      ...current,
      origins: current.origins.filter((origin) => origin.id !== id),
    }));
  }, []);

  const createDebtor = useCallback(async (payload) => {
    const { data } = await api.post("/api/debtors", payload);
    setState((current) => ({
      ...current,
      debtors: [...current.debtors, data],
    }));
    return data;
  }, []);

  const deleteDebtor = useCallback(async (id) => {
    await api.delete(`/api/debtors/${id}`);
    setState((current) => ({
      ...current,
      debtors: current.debtors.filter((debtor) => debtor.id !== id),
    }));
  }, []);

  const saveSalaryForMonth = useCallback(
    async (targetMonth, payload) => {
      const normalized = {
        month: targetMonth,
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

      const existing = state.salaryHistory[targetMonth];
      let response;
      if (existing?.id) {
        response = await api.put(
          `/api/salaryHistory/${existing.id}`,
          normalized
        );
      } else {
        response = await api.post("/api/salaryHistory", normalized);
      }

      const updatedRecord = {
        ...response.data,
        hours: String(response.data.hours),
        hourRate: String(response.data.hourRate),
        taxRate: String(response.data.taxRate),
        cnae: response.data.cnae ?? "",
      };

      setState((current) => ({
        ...current,
        salaryHistory: {
          ...current.salaryHistory,
          [updatedRecord.month]: updatedRecord,
        },
      }));
      return updatedRecord;
    },
    [state.salaryHistory]
  );

  const derived = useMemo(
    () => ({
      debtorById: Object.fromEntries(state.debtors.map((d) => [d.id, d.name])),
      originById: Object.fromEntries(state.origins.map((o) => [o.id, o])),
    }),
    [state.debtors, state.origins]
  );

  return {
    state,
    month,
    setMonth: saveMonth,
    loading,
    error,
    refresh: fetchAll,
    createExpense,
    deleteExpense,
    createOrigin,
    deleteOrigin,
    createDebtor,
    deleteDebtor,
    saveSalaryForMonth,
    ...derived,
  };
}
