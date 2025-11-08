import { SnackbarProvider, useSnackbar, type OptionsObject } from "notistack";
import { isAxiosError } from "axios";
import { useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";

const SUCCESS_MESSAGE = "Operação concluída com sucesso";
const ERROR_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";
const TOAST_DEBOUNCE_MS = 2000;

const ERROR_MAP: Record<string, string> = {
  E_VALIDATION: "Alguns campos precisam de atenção antes de continuar.",
  E_DUPLICATE: "Este registro já existe.",
  E_NOT_FOUND: "Registro não encontrado.",
  E_FORBIDDEN: "Você não tem permissão para executar essa ação.",
  E_UNAUTHORIZED: "Sessão expirada. Faça login novamente.",
  E_CONFLICT: "Conflito de dados detectado.",
  E_RATE_LIMIT: "Muitas requisições em sequência. Aguarde alguns segundos.",
  E_INTERNAL: ERROR_MESSAGE,
};

type BackendErrorPayload = {
  code?: string;
  message?: string;
  error?: string;
  errors?: Array<{ message?: string }>;
};

const extractErrorDetails = (error: unknown): { code?: string; message?: string } => {
  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as BackendErrorPayload;
    const nestedMessage =
      Array.isArray(payload.errors) && payload.errors.length
        ? payload.errors.map((item) => item?.message).filter(Boolean).join(", ")
        : undefined;
    return {
      code: payload.code ?? error.code ?? undefined,
      message: payload.message ?? nestedMessage ?? error.message,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return {};
};

export const mapBackendError = (code?: string, fallback = ERROR_MESSAGE) => {
  if (!code) return fallback;
  const normalized = code.toUpperCase();
  return ERROR_MAP[normalized] ?? fallback;
};

type ToastOptions = OptionsObject & { key?: string; debounceMs?: number };
type ErrorToastOptions = ToastOptions & { fallbackMessage?: string };

export const useToast = () => {
  const { enqueueSnackbar } = useSnackbar();
  const historyRef = useRef<Map<string, number>>(new Map());

  const baseShow = useCallback(
    (message: string, variant: OptionsObject["variant"], options?: ToastOptions) => {
      if (!message) return;
      const debounce = options?.debounceMs ?? TOAST_DEBOUNCE_MS;
      const key = options?.key ?? `${variant ?? "default"}-${message}`;
      const last = historyRef.current.get(key) ?? 0;
      const now = Date.now();
      if (now - last < debounce) {
        return;
      }
      historyRef.current.set(key, now);
      const { debounceMs: _debounceMs, ...rest } = options ?? {};
      enqueueSnackbar(message, {
        variant,
        key,
        anchorOrigin: { vertical: "bottom", horizontal: "right" },
        ...rest,
      });
    },
    [enqueueSnackbar]
  );

  const success = useCallback(
    (message = SUCCESS_MESSAGE, options?: ToastOptions) => baseShow(message, "success", options),
    [baseShow]
  );

  const info = useCallback(
    (message: string, options?: ToastOptions) => baseShow(message, "info", options),
    [baseShow]
  );

  const warning = useCallback(
    (message: string, options?: ToastOptions) => baseShow(message, "warning", options),
    [baseShow]
  );

  const error = useCallback(
    (input: unknown, options?: ErrorToastOptions) => {
      const details = extractErrorDetails(input);
      const fallback = options?.fallbackMessage ?? details.message ?? ERROR_MESSAGE;
      const mapped = mapBackendError(details.code, fallback);
      baseShow(mapped, "error", options);
    },
    [baseShow]
  );

  return useMemo(
    () => ({
      success,
      error,
      info,
      warning,
    }),
    [success, error, info, warning]
  );
};

type FeedbackProviderProps = {
  children: ReactNode;
};

export function FeedbackProvider({ children }: FeedbackProviderProps) {
  return (
    <SnackbarProvider
      maxSnack={4}
      autoHideDuration={4000}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      preventDuplicate
    >
      {children}
    </SnackbarProvider>
  );
}

export const feedback = {
  mapBackendError,
  SUCCESS_MESSAGE,
  ERROR_MESSAGE,
};
