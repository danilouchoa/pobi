import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createDebtor,
  createOrigin,
  deleteDebtor,
  deleteOrigin,
  getDebtors,
  getOrigins,
  updateDebtor,
  updateOrigin,
} from "../services/catalogService";
import { catalogKeys } from "../lib/queryKeys";
import { DebtorPayload, OriginPayload } from "../types";
import { useAuth } from "../context/useAuth";

type Options = {
  enabled?: boolean;
};

export function useCatalogs(options: Options = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const enabled = (options.enabled ?? true) && Boolean(userId);
  const originsKey = userId
    ? catalogKeys.origins(userId)
    : (["catalogs", "origins", "disabled"] as const);
  const debtorsKey = userId
    ? catalogKeys.debtors(userId)
    : (["catalogs", "debtors", "disabled"] as const);

  const originsQuery = useQuery({
    queryKey: originsKey,
    queryFn: getOrigins,
    enabled,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });

  const debtorsQuery = useQuery({
    queryKey: debtorsKey,
    queryFn: getDebtors,
    enabled,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });

  const invalidateOrigins = () =>
    userId ? queryClient.invalidateQueries({ queryKey: catalogKeys.origins(userId) }) : Promise.resolve();
  const invalidateDebtors = () =>
    userId ? queryClient.invalidateQueries({ queryKey: catalogKeys.debtors(userId) }) : Promise.resolve();

  const createOriginMutation = useMutation({
    mutationFn: (payload: OriginPayload) => createOrigin(payload),
    onSuccess: invalidateOrigins,
  });

  const updateOriginMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OriginPayload }) =>
      updateOrigin(id, payload),
    onSuccess: invalidateOrigins,
  });

  const deleteOriginMutation = useMutation({
    mutationFn: (id: string) => deleteOrigin(id),
    onSuccess: invalidateOrigins,
  });

  const createDebtorMutation = useMutation({
    mutationFn: (payload: DebtorPayload) => createDebtor(payload),
    onSuccess: invalidateDebtors,
  });

  const updateDebtorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DebtorPayload }) =>
      updateDebtor(id, payload),
    onSuccess: invalidateDebtors,
  });

  const deleteDebtorMutation = useMutation({
    mutationFn: (id: string) => deleteDebtor(id),
    onSuccess: invalidateDebtors,
  });

  return {
    originsQuery,
    debtorsQuery,
    createOrigin: createOriginMutation.mutateAsync,
    updateOrigin: (id: string, payload: OriginPayload) =>
      updateOriginMutation.mutateAsync({ id, payload }),
    deleteOrigin: deleteOriginMutation.mutateAsync,
    createDebtor: createDebtorMutation.mutateAsync,
    updateDebtor: (id: string, payload: DebtorPayload) =>
      updateDebtorMutation.mutateAsync({ id, payload }),
    deleteDebtor: deleteDebtorMutation.mutateAsync,
  };
}
