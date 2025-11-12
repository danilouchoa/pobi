import { useCallback } from "react";
import { useSnackbar } from "notistack";
import { mapBackendError } from "../utils/mapBackendError";

type ToastPayload =
  | string
  | Error
  | {
      message?: string;
      code?: string;
    }
  | null
  | undefined;

const resolveMessage = (payload: ToastPayload, fallback: string) => {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload instanceof Error) return payload.message || fallback;
  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message;
  }
  if (payload.code) {
    return mapBackendError(payload.code, fallback);
  }
  return fallback;
};

export function useToast() {
  const { enqueueSnackbar } = useSnackbar();

  const success = useCallback(
    (payload?: ToastPayload) => {
      enqueueSnackbar(resolveMessage(payload, "Operação realizada com sucesso."), {
        variant: "success",
      });
    },
    [enqueueSnackbar]
  );

  const error = useCallback(
    (payload?: ToastPayload) => {
      enqueueSnackbar(resolveMessage(payload, "Não foi possível completar a operação."), {
        variant: "error",
      });
    },
    [enqueueSnackbar]
  );

  const info = useCallback(
    (payload?: ToastPayload) => {
      enqueueSnackbar(resolveMessage(payload, "Atualização disponível."), {
        variant: "info",
      });
    },
    [enqueueSnackbar]
  );

  const warning = useCallback(
    (payload?: ToastPayload) => {
      enqueueSnackbar(resolveMessage(payload, "Ação requer atenção."), {
        variant: "warning",
      });
    },
    [enqueueSnackbar]
  );

  return { success, error, info, warning };
}
