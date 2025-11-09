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
  createRecurringExpense,
  deleteExpense,
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
  const queryKey = expensesKeys.list(month, mode, page, limit);

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
    queryKey: expensesKeys.recurring,
    queryFn: getRecurringExpenses,
    enabled: false,
  });

  const sharedQuery = useQuery({
    queryKey: expensesKeys.shared,
    queryFn: getSharedExpenses,
    enabled: false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: expensesKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createExpense(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);
      if (page === 1) {
        const optimistic = buildOptimisticExpense(payload, mode, month);
        queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => {
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
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayload }) =>
      updateExpense(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);
      queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((expense) =>
            expense.id === id ? mergeExpenseWithPayload(expense, payload) : expense
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExpensesResponse | undefined>(queryKey);
      queryClient.setQueryData<ExpensesResponse | undefined>(queryKey, (old) => {
        if (!old) return old;
        const nextData = old.data.filter((expense) => expense.id !== id);
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
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidateAll,
  });

  const duplicateMutation = useMutation({
    mutationFn: ({
      id,
      options: duplicateOptions,
    }: {
      id: string;
      options?: { incrementMonth?: boolean; customDate?: string };
    }) => duplicateExpense(id, duplicateOptions),
    onSuccess: invalidateAll,
  });

  const createRecurringMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createRecurringExpense(payload),
    onSuccess: invalidateAll,
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateExpenses,
    onSuccess: invalidateAll,
  });

  const bulkActionMutation = useMutation({
    mutationFn: bulkExpensesAction,
    onSuccess: invalidateAll,
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
    createExpense: createMutation.mutateAsync,
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
