import {
  QueryKey,
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  bulkUpdateExpenses,
  bulkExpensesAction,
  createExpense,
  createExpensesBatch,
  createRecurringExpense,
  deleteExpense,
  deleteGroup,
  duplicateExpense,
  getExpenses,
  getRecurringExpenses,
  getSharedExpenses,
  updateExpense,
} from "../services/expenseService";
import { expensesKeys } from "../lib/queryKeys";
import { Expense, ExpensePayload, ExpensesResponse, Pagination } from "../types";

type Options = {
  enabled?: boolean;
  mode?: "calendar" | "billing";
  page?: number;
  limit?: number;
};

type OptimisticSnapshot = {
  queryKey: QueryKey;
  data: ExpensesResponse | undefined;
};

type OptimisticContext = {
  snapshots: OptimisticSnapshot[];
};

type CreateExpenseVariables = {
  payload: ExpensePayload;
};

type CreateExpenseBatchVariables = {
  payloads: ExpensePayload[];
};

type ListKeyMeta = {
  month: string;
  mode: "calendar" | "billing";
  page: number;
  limit: number;
};

const parseListKey = (queryKey: QueryKey): ListKeyMeta | null => {
  if (!Array.isArray(queryKey)) return null;
  const [root, scope, params] = queryKey;
  if (root !== "expenses" || scope !== "list") return null;
  if (!params || typeof params !== "object") return null;

  const { month, mode = "calendar", page = 1, limit = 20 } = params as {
    month?: string;
    mode?: "calendar" | "billing";
    page?: number;
    limit?: number;
  };

  if (!month) return null;

  return {
    month,
    mode,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
  };
};

const mergeExpenseWithPayload = (
  base: Expense,
  payload: ExpensePayload
): Expense => ({
  ...base,
  description: payload.description,
  category: payload.category,
  parcela: payload.parcela ?? base.parcela ?? "",
  amount: Number(payload.amount),
  date: payload.date,
  originId: payload.originId ?? null,
  debtorId: payload.debtorId ?? null,
  recurring: payload.recurring,
  recurrenceType: payload.recurrenceType ?? null,
  fixed: payload.fixed,
  installments: payload.installments ?? null,
  sharedWith: payload.sharedWith ?? null,
  sharedAmount: payload.sharedAmount ?? null,
  billingMonth: base.billingMonth ?? null,
});

const buildOptimisticExpense = (
  payload: ExpensePayload,
  mode: "calendar" | "billing",
  month: string
): Expense =>
  mergeExpenseWithPayload(
    {
      id: `temp-${Date.now()}`,
      description: "",
      category: "",
      parcela: "",
      amount: 0,
      date: payload.date,
      originId: null,
      debtorId: null,
      recurring: payload.recurring,
      recurrenceType: payload.recurrenceType ?? null,
      fixed: payload.fixed,
      installments: null,
      sharedWith: null,
      sharedAmount: null,
      billingMonth: mode === "billing" ? month : null,
    },
    payload
  );

export function useExpenses(month: string, options: Options = {}) {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const mode = options.mode ?? "calendar";
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const queryKey = expensesKeys.list({ month, mode, page, limit });
  const monthKey = expensesKeys.month({ month, mode });
  const recurringKey = expensesKeys.recurring();
  const sharedKey = expensesKeys.shared();

  const expenseQueryPredicate = ({ queryKey: key }: { queryKey: QueryKey }) => {
    const meta = parseListKey(key);
    if (!meta) return false;
    if (meta.month !== month) return false;
    if ((meta.mode ?? "calendar") !== mode) return false;
    return true;
  };

  const listQueriesForCurrentView = () =>
    queryClient
      .getQueriesData<ExpensesResponse>({ predicate: expenseQueryPredicate })
      .map(([key, data]) => ({ queryKey: key, data, meta: parseListKey(key)! }));

  const captureSnapshots = (): OptimisticSnapshot[] =>
    listQueriesForCurrentView().map(({ queryKey, data }) => ({ queryKey, data }));

  const applyToListQueries = (
    updater: (current: ExpensesResponse | undefined, meta: ListKeyMeta) => ExpensesResponse | undefined
  ) => {
    const entries = listQueriesForCurrentView();
    entries.forEach(({ queryKey, meta }) => {
      queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => updater(old, meta));
    });
    return entries.map(({ queryKey, data }) => ({ queryKey, data }));
  };

  const upsertVisibleExpenses = (items: Expense[]) => {
    if (!items.length) return;
    applyToListQueries((old, meta) => {
      const base: ExpensesResponse =
        old ?? {
          data: [],
          pagination: { page: meta.page, limit: meta.limit, total: 0, pages: 1 },
        };
      const limitCap = base.pagination.limit ?? meta.limit;
      const filtered = base.data.filter(
        (expense) => !items.some((incoming) => incoming.id === expense.id) && !expense.id.startsWith("temp-")
      );
      const nextData = [...items, ...filtered].slice(0, limitCap);
      const nextTotal = Math.max(base.pagination.total, filtered.length + items.length);
      const nextPages = Math.max(1, Math.ceil(nextTotal / limitCap));
      return {
        data: nextData,
        pagination: {
          ...base.pagination,
          total: nextTotal,
          pages: nextPages,
        },
      };
    });
  };

  const toMonth = (value?: string | null) => (value ? value.slice(0, 7) : "");

  const matchesCurrentView = (expense: { date?: string; billingMonth?: string | null }) => {
    if (mode === "billing") {
      return expense.billingMonth ? expense.billingMonth === month : false;
    }
    return toMonth(expense.date ?? null) === month;
  };

  const rollback = (ctx?: OptimisticContext) => {
    if (!ctx?.snapshots?.length) return;
    ctx.snapshots.forEach(({ queryKey: key, data }) => {
      queryClient.setQueryData<ExpensesResponse | undefined>(key, data);
    });
  };

  const expensesQuery = useQuery({
    queryKey,
    queryFn: () => getExpenses(month, mode, page, limit),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const recurringQuery = useQuery({
    queryKey: recurringKey,
    queryFn: getRecurringExpenses,
    enabled: false,
  });

  const sharedQuery = useQuery({
    queryKey: sharedKey,
    queryFn: getSharedExpenses,
    enabled: false,
  });

  const invalidateExpensesForMonth = async (options?: { refetchActiveLists?: boolean }) => {
    const refetchLists = options?.refetchActiveLists ?? false;

    await queryClient.invalidateQueries({ predicate: expenseQueryPredicate, refetchType: refetchLists ? "all" : "inactive" });
    await queryClient.invalidateQueries({ queryKey: monthKey, refetchType: "all" });
    await queryClient.invalidateQueries({ queryKey: recurringKey, refetchType: "all" });
    await queryClient.invalidateQueries({ queryKey: sharedKey, refetchType: "all" });
  };

  const createMutation = useMutation({
    mutationFn: ({ payload }: CreateExpenseVariables) => createExpense(payload),
    onMutate: async ({ payload }: CreateExpenseVariables) => {
      await queryClient.cancelQueries({ predicate: expenseQueryPredicate });
      const snapshots = captureSnapshots();

      if (matchesCurrentView({ date: payload.date, billingMonth: (payload as any)?.billingMonth ?? null })) {
        const optimistic = buildOptimisticExpense(payload, mode, month);
        applyToListQueries((old, meta) => {
          const base: ExpensesResponse =
            old ?? {
              data: [],
              pagination: { page: meta.page, limit: meta.limit, total: 0, pages: 1 },
            };
          const limitCap = base.pagination.limit ?? meta.limit;
          const nextTotal = base.pagination.total + 1;
          const nextPages = Math.max(1, Math.ceil(nextTotal / limitCap));
          return {
            data: [optimistic, ...base.data].slice(0, limitCap),
            pagination: {
              ...base.pagination,
              total: nextTotal,
              pages: nextPages,
            },
          };
        });
      }
      return { snapshots };
    },
    onError: (_err: unknown, _vars: CreateExpenseVariables, ctx?: OptimisticContext) => rollback(ctx),
    onSuccess: async (created: Expense) => {
      const visible = matchesCurrentView(created) ? [created] : [];
      upsertVisibleExpenses(visible);
      await invalidateExpensesForMonth({ refetchActiveLists: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayload }) =>
      updateExpense(id, payload),
    onMutate: async ({ id, payload }: { id: string; payload: ExpensePayload }) => {
      await queryClient.cancelQueries({ predicate: expenseQueryPredicate });
      const snapshots = captureSnapshots();
      applyToListQueries((old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((expense: Expense) =>
            expense.id === id ? mergeExpenseWithPayload(expense, payload) : expense
          ),
        };
      });
      return { snapshots };
    },
    onError: (_err: unknown, _vars: { id: string; payload: ExpensePayload }, ctx?: OptimisticContext) =>
      rollback(ctx),
    onSuccess: async (updated: Expense) => {
      applyToListQueries((old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((expense) => (expense.id === updated.id ? updated : expense)),
        };
      });
      await invalidateExpensesForMonth({ refetchActiveLists: false });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await deleteExpense(id);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          return { success: true } as any;
        }
        throw err;
      }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ predicate: expenseQueryPredicate });
      const snapshots = applyToListQueries((old, meta) => {
        if (!old) return old;
        const nextData = old.data.filter((expense: Expense) => expense.id !== id);
        if (nextData.length === old.data.length) {
          return old;
        }
        const limitCap = old.pagination.limit ?? meta.limit;
        const nextTotal = Math.max(0, old.pagination.total - 1);
        const nextPages = Math.max(1, Math.ceil(nextTotal / limitCap));
        const nextPage = Math.min(old.pagination.page, nextPages);
        return {
          data: nextData,
          pagination: {
            ...old.pagination,
            total: nextTotal,
            pages: nextPages,
            page: nextPage,
          },
        };
      });
      return { snapshots };
    },
    onError: (_err: unknown, _vars: string, ctx?: OptimisticContext) => {
      rollback(ctx);
    },
    onSuccess: async () => {
      await invalidateExpensesForMonth();
      await queryClient.refetchQueries({ predicate: expenseQueryPredicate });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({
      id,
      options: duplicateOptions,
    }: {
      id: string;
      options?: { incrementMonth?: boolean; customDate?: string };
    }) => duplicateExpense(id, duplicateOptions),
    onSuccess: invalidateExpensesForMonth,
  });

  const createBatchMutation = useMutation({
    mutationFn: ({ payloads }: CreateExpenseBatchVariables) => createExpensesBatch(payloads),
    onMutate: async ({ payloads }: CreateExpenseBatchVariables) => {
      await queryClient.cancelQueries({ predicate: expenseQueryPredicate });
      const snapshots = captureSnapshots();

      const optimisticItems = payloads
        .filter((payload) => matchesCurrentView({ date: payload.date, billingMonth: (payload as any)?.billingMonth ?? null }))
        .map((payload: ExpensePayload) => buildOptimisticExpense(payload, mode, month));

      if (optimisticItems.length) {
        applyToListQueries((old, meta) => {
          const base: ExpensesResponse =
            old ?? {
              data: [],
              pagination: { page: meta.page, limit: meta.limit, total: 0, pages: 1 },
            };
          const limitCap = base.pagination.limit ?? meta.limit;
          const nextTotal = base.pagination.total + optimisticItems.length;
          const nextPages = Math.max(1, Math.ceil(nextTotal / limitCap));
          return {
            data: [...optimisticItems, ...base.data].slice(0, limitCap),
            pagination: {
              ...base.pagination,
              total: nextTotal,
              pages: nextPages,
            },
          };
        });
      }

      return { snapshots };
    },
    onError: (_err: unknown, _vars: CreateExpenseBatchVariables, ctx?: OptimisticContext) => rollback(ctx),
    onSuccess: async (createdExpenses: Expense[]) => {
      const visible = createdExpenses.filter((expense) => matchesCurrentView(expense));
      upsertVisibleExpenses(visible);
      await invalidateExpensesForMonth();
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createRecurringExpense(payload),
    onSuccess: async (created: Expense) => {
      if (matchesCurrentView(created)) {
        applyToListQueries((old, meta) => {
          const base: ExpensesResponse =
            old ?? {
              data: [],
              pagination: { page: meta.page, limit: meta.limit, total: 0, pages: 1 },
            };
          const limitCap = base.pagination.limit ?? meta.limit;
          const filtered = base.data.filter((expense) => expense.id !== created.id);
          const nextData = [created, ...filtered].slice(0, limitCap);
          const nextTotal = Math.max(base.pagination.total, filtered.length + 1);
          const nextPages = Math.max(1, Math.ceil(nextTotal / limitCap));
          return {
            data: nextData,
            pagination: {
              ...base.pagination,
              total: nextTotal,
              pages: nextPages,
            },
          };
        });
      }

      await invalidateExpensesForMonth();
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateExpenses,
    onSuccess: invalidateExpensesForMonth,
  });

  const bulkActionMutation = useMutation({
    mutationFn: bulkExpensesAction,
    onSuccess: invalidateExpensesForMonth,
  });

  const pagination: Pagination =
    expensesQuery.data?.pagination ?? {
      page,
      limit,
      total: 0,
      pages: 1,
    };

  return {
    expensesQuery,
    recurringQuery,
    sharedQuery,
    pagination,
    createExpense: (payload: ExpensePayload) =>
      createMutation.mutateAsync({ payload }),
    createExpenseBatch: (payloads: ExpensePayload[]) =>
      createBatchMutation.mutateAsync({ payloads }),
    updateExpense: (id: string, payload: ExpensePayload) =>
      updateMutation.mutateAsync({ id, payload }),
    deleteExpense: deleteMutation.mutateAsync,
    duplicateExpense: (id: string, duplicateOptions?: { incrementMonth?: boolean; customDate?: string }) =>
      duplicateMutation.mutateAsync({ id, options: duplicateOptions }),
    createRecurringExpense: createRecurringMutation.mutateAsync,
    fetchRecurringExpenses: recurringQuery.refetch,
    fetchSharedExpenses: sharedQuery.refetch,
    bulkUpdate: bulkUpdateMutation.mutateAsync, // legado fila async
    bulkDelete: (ids: string[]) => bulkActionMutation.mutateAsync({ action: 'delete', ids }),
    bulkUpdateInline: (items: { id: string; category?: string; originId?: string; fixed?: boolean; recurring?: boolean; recurrenceType?: "monthly" | "weekly" | "yearly" | null }[]) =>
      bulkActionMutation.mutateAsync({ action: 'update', items }),
  };
}

export const useDeleteExpenseGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
    },
  });
};
