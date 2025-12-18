import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

type OptimisticContext = {
  previous: ExpensesResponse | undefined;
};

type CreateExpenseVariables = {
  payload: ExpensePayload;
};

type CreateExpenseBatchVariables = {
  payloads: ExpensePayload[];
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

  const toMonth = (value?: string | null) => (value ? value.slice(0, 7) : "");

  const matchesCurrentView = (expense: { date?: string; billingMonth?: string | null }) => {
    if (mode === "billing") {
      return expense.billingMonth ? expense.billingMonth === month : false;
    }
    return toMonth(expense.date ?? null) === month;
  };

  const rollback = (ctx?: OptimisticContext) => {
    if (!ctx?.previous) return;
    queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, ctx.previous);
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

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: expensesKeys.all }),
      queryClient.invalidateQueries({ queryKey: monthKey }),
      queryClient.invalidateQueries({ queryKey: recurringKey }),
      queryClient.invalidateQueries({ queryKey: sharedKey }),
    ]);
  };

  const refetchActiveList = async () => {
    await queryClient.refetchQueries({ queryKey, type: "active" });
  };

  const invalidateAndRefetch = async () => {
    await invalidateAll();
    await refetchActiveList();
  };

  const createMutation = useMutation({
    mutationFn: ({ payload }: CreateExpenseVariables) => createExpense(payload),
    onMutate: async ({ payload }: CreateExpenseVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);
      if (page === 1 && matchesCurrentView({ date: payload.date, billingMonth: (payload as any)?.billingMonth ?? null })) {
        const optimistic = buildOptimisticExpense(payload, mode, month);
        queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old: ExpensesResponse | undefined) => {
          const base: ExpensesResponse =
            old ?? {
              data: [],
              pagination: { page: 1, limit, total: 0, pages: 1 },
            };
          const limitCap = base.pagination.limit ?? limit;
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
      return { previous };
    },
    onError: (_err: unknown, _vars: CreateExpenseVariables, ctx?: OptimisticContext) => rollback(ctx),
    onSuccess: async (created: Expense) => {
      if (page === 1 && matchesCurrentView(created)) {
        queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => {
          const base: ExpensesResponse =
            old ?? {
              data: [],
              pagination: { page: 1, limit, total: 0, pages: 1 },
            };
          const limitCap = base.pagination.limit ?? limit;
          const filtered = base.data.filter((expense) => expense.id !== created.id && !expense.id.startsWith("temp-"));
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
      await invalidateAndRefetch();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayload }) =>
      updateExpense(id, payload),
    onMutate: async ({ id, payload }: { id: string; payload: ExpensePayload }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);
      queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old: ExpensesResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((expense: Expense) =>
            expense.id === id ? mergeExpenseWithPayload(expense, payload) : expense
          ),
        };
      });
      return { previous };
    },
    onError: (_err: unknown, _vars: { id: string; payload: ExpensePayload }, ctx?: OptimisticContext) =>
      rollback(ctx),
    onSuccess: async (updated: Expense) => {
      queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((expense) => (expense.id === updated.id ? updated : expense)),
        };
      });
      await invalidateAndRefetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);
      queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old: ExpensesResponse | undefined) => {
        if (!old) return old;
        const nextData = old.data.filter((expense: Expense) => expense.id !== id);
        if (nextData.length === old.data.length) {
          return old;
        }
        const limitCap = old.pagination.limit ?? limit;
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
      return { previous };
    },
    onError: (_err: unknown, _vars: string, ctx?: OptimisticContext) => rollback(ctx),
    onSuccess: invalidateAndRefetch,
  });

  const duplicateMutation = useMutation({
    mutationFn: ({
      id,
      options: duplicateOptions,
    }: {
      id: string;
      options?: { incrementMonth?: boolean; customDate?: string };
    }) => duplicateExpense(id, duplicateOptions),
    onSuccess: invalidateAndRefetch,
  });

  const createBatchMutation = useMutation({
    mutationFn: ({ payloads }: CreateExpenseBatchVariables) => createExpensesBatch(payloads),
    onMutate: async ({ payloads }: CreateExpenseBatchVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);

      if (page === 1 && payloads.length) {
        const optimisticItems = payloads
          .filter((payload) => matchesCurrentView({ date: payload.date, billingMonth: (payload as any)?.billingMonth ?? null }))
          .map((payload: ExpensePayload) => buildOptimisticExpense(payload, mode, month));
        queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old: ExpensesResponse | undefined) => {
          const base: ExpensesResponse =
            old ?? {
              data: [],
              pagination: { page: 1, limit, total: 0, pages: 1 },
            };
          const limitCap = base.pagination.limit ?? limit;
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

      return { previous };
    },
    onError: (_err: unknown, _vars: CreateExpenseBatchVariables, ctx?: OptimisticContext) => rollback(ctx),
    onSuccess: async (createdExpenses: Expense[]) => {
      if (page === 1 && createdExpenses.length) {
        const visible = createdExpenses.filter((expense) => matchesCurrentView(expense));
        if (visible.length) {
          queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => {
            const base: ExpensesResponse =
              old ?? {
                data: [],
                pagination: { page: 1, limit, total: 0, pages: 1 },
              };
            const limitCap = base.pagination.limit ?? limit;
            const filtered = base.data.filter((expense) => !expense.id.startsWith("temp-"));
            const nextData = [...visible, ...filtered].slice(0, limitCap);
            const nextTotal = Math.max(base.pagination.total, filtered.length + visible.length);
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
      }
      await invalidateAndRefetch();
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createRecurringExpense(payload),
    onSuccess: invalidateAndRefetch,
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateExpenses,
    onSuccess: invalidateAndRefetch,
  });

  const bulkActionMutation = useMutation({
    mutationFn: bulkExpensesAction,
    onSuccess: invalidateAndRefetch,
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
