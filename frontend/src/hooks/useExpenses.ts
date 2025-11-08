import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
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
import { Expense, ExpensePayload } from "../types";

type Options = {
  enabled?: boolean;
  mode?: "calendar" | "billing";
};

type OptimisticContext = {
  previous: Expense[] | undefined;
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
});

const buildOptimisticExpense = (payload: ExpensePayload): Expense =>
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
    },
    payload
  );

export function useExpenses(month: string, options: Options = {}) {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const mode = options.mode ?? "calendar";
  const monthKey = expensesKeys.month(month, mode);
  const rollback = (ctx?: OptimisticContext) => {
    if (!ctx?.previous) return;
    queryClient.setQueryData(monthKey, ctx.previous);
  };

  const expensesQuery = useQuery({
    queryKey: monthKey,
    queryFn: () => getExpenses(month, mode),
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

  const invalidateMonth = () => {
    (['calendar', 'billing'] as const).forEach((view) => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.month(month, view) });
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createExpense(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: monthKey });
      const previous = queryClient.getQueryData<Expense[]>(monthKey);
      const optimistic = buildOptimisticExpense(payload);
      queryClient.setQueryData<Expense[]>(monthKey, (old = []) => [optimistic, ...old]);
      return { previous } as OptimisticContext;
    },
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidateMonth,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpensePayload }) =>
      updateExpense(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: monthKey });
      const previous = queryClient.getQueryData<Expense[]>(monthKey);
      queryClient.setQueryData<Expense[]>(monthKey, (old = []) =>
        old.map((expense) =>
          expense.id === id ? mergeExpenseWithPayload(expense, payload) : expense
        )
      );
      return { previous } as OptimisticContext;
    },
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidateMonth,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: monthKey });
      const previous = queryClient.getQueryData<Expense[]>(monthKey);
      queryClient.setQueryData<Expense[]>(monthKey, (old = []) =>
        old.filter((expense) => expense.id !== id)
      );
      return { previous } as OptimisticContext;
    },
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidateMonth,
  });

  const duplicateMutation = useMutation({
    mutationFn: ({
      id,
      options: duplicateOptions,
    }: {
      id: string;
      options?: { incrementMonth?: boolean; customDate?: string };
    }) => duplicateExpense(id, duplicateOptions),
    onSuccess: invalidateMonth,
  });

  const createRecurringMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createRecurringExpense(payload),
    onSuccess: invalidateMonth,
  });

  return {
    expensesQuery,
    recurringQuery,
    sharedQuery,
    createExpense: createMutation.mutateAsync,
    updateExpense: (id: string, payload: ExpensePayload) =>
      updateMutation.mutateAsync({ id, payload }),
    deleteExpense: deleteMutation.mutateAsync,
    duplicateExpense: (id: string, duplicateOptions?: { incrementMonth?: boolean; customDate?: string }) =>
      duplicateMutation.mutateAsync({ id, options: duplicateOptions }),
    createRecurringExpense: createRecurringMutation.mutateAsync,
    fetchRecurringExpenses: recurringQuery.refetch,
    fetchSharedExpenses: sharedQuery.refetch,
  };
}
