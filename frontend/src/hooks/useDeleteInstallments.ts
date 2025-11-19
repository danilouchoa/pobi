import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushSync } from "react-dom";
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
  const [isDeletingInstallments, setIsDeletingInstallments] = useState(false);

  const deleteInstallments = useCallback(
    async (installmentIds: string[]) => {
      flushSync(() => setIsDeletingInstallments(true));

      try {
        await deleteInstallmentsRequest(installmentIds);
        toast.success("Parcelas excluídas com sucesso.");
      } catch (error) {
        toast.error("Não foi possível excluir as parcelas. Tente novamente.");
        throw error;
      } finally {
        flushSync(() => setIsDeletingInstallments(false));
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: expensesKeys.all }),
          queryClient.invalidateQueries({ queryKey: expensesKeys.month(month, mode) }),
        ]);
      }
    },
    [mode, month, queryClient, toast]
  );

  return {
    deleteInstallments,
    isDeletingInstallments,
  };
}
