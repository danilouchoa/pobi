import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteInstallments as deleteInstallmentsRequest } from "../services/expenseService";
import { expensesKeys } from "../lib/queryKeys";
import { useToast } from "./useToast";

type UseDeleteInstallmentsOptions = {
  month: string;
  mode: "calendar" | "billing";
};

export function useDeleteInstallments({ month, mode }: UseDeleteInstallmentsOptions) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (installmentIds: string[]) => deleteInstallmentsRequest(installmentIds),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: expensesKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(error);
    },
    onSuccess: () => {
      toast.success("Parcelas excluídas com sucesso.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
      queryClient.invalidateQueries({ queryKey: expensesKeys.month(month, mode) });
    },
  });

  return {
    deleteInstallments: mutation.mutateAsync,
    isDeletingInstallments: mutation.isPending,
  };
}
