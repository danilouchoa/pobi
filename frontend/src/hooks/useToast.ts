import { useCallback, useMemo, useRef } from "react";
import { useSnackbar, type OptionsObject } from "notistack";
import { mapBackendError } from "../utils/mapBackendError";
import { isAxiosError } from "axios";

/**
 * useToast.ts
 *
 * Hook responsável por padronizar os toasts usados nos CRUDs.
 * - Centraliza a mensagem de sucesso/erro para manter consistência.
 * - Integra com o notistack (configurado globalmente em ToastProvider).
 * - Usa um mapa com timestamps para impedir duplicidade de mensagens em ações rápidas (ex.: duplo clique).
 */

const DEFAULT_SUCCESS_MESSAGE = "Operação concluída com sucesso";
const DEFAULT_ERROR_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";
const DEFAULT_DEBOUNCE_MS = 2000;

type ToastOptions = OptionsObject & {
  /**
   * key opcional para controlar manualmente a deduplicação.
   */
  key?: string;
  /**
   * Permite customizar o intervalo mínimo entre toasts repetidos.
   */
  debounceMs?: number;
};

type ErrorToastOptions = ToastOptions & {
  /**
   * Mensagem fallback caso o backend não envie detalhes.
   */
  fallbackMessage?: string;
};

export const useToast = () => {
  const { enqueueSnackbar } = useSnackbar();
  /**
   * Guarda o timestamp da última emissão para cada chave, evitando que operações rápidas
   * disparem toasts duplicados e poluam a UX (racional pedido na milestone).
   */
  const emissionHistoryRef = useRef<Map<string, number>>(new Map());

  const baseShow = useCallback(
    (message: string, variant: OptionsObject["variant"], options?: ToastOptions) => {
      if (!message) return;
      const key = options?.key ?? `${variant}-${message}`;
      const debounceWindow = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
      const lastEmission = emissionHistoryRef.current.get(key) ?? 0;
      const now = Date.now();

      // Evita toasts repetidos dentro da janela configurada, mitigando ruído visual.
      if (now - lastEmission < debounceWindow) {
        return;
      }

      emissionHistoryRef.current.set(key, now);
      const { debounceMs: _debounce, ...snackbarOptions } = options ?? {};
      enqueueSnackbar(message, {
        variant,
        ...snackbarOptions,
      });
    },
    [enqueueSnackbar]
  );

  /**
   * Toast padronizado para operações concluídas com sucesso (create/update/delete).
   */
  const success = useCallback(
    (message = DEFAULT_SUCCESS_MESSAGE, options?: ToastOptions) =>
      baseShow(message, "success", options),
    [baseShow]
  );

  /**
   * Mensagens informativas (ex.: job enfileirado).
   */
  const info = useCallback(
    (message: string, options?: ToastOptions) => baseShow(message, "info", options),
    [baseShow]
  );

  /**
   * Avisos para dados incompletos antes de enviar ao backend.
   */
  const warning = useCallback(
    (message: string, options?: ToastOptions) => baseShow(message, "warning", options),
    [baseShow]
  );

  /**
   * Tratamento de erros: aproveita o mapBackendError para traduzir códigos técnicos.
   */
  const error = useCallback(
    (input: unknown, options?: ErrorToastOptions) => {
      const fallback = options?.fallbackMessage ?? DEFAULT_ERROR_MESSAGE;

      /**
       * A API envia grande parte dos erros via AxiosError. Extraímos o código customizado
       * para alimentar o mapBackendError; se não existir, mantemos mensagens legíveis.
       */
      if (isAxiosError(input)) {
        const payload = (input.response?.data ?? {}) as { code?: string; message?: string };
        const mapped = mapBackendError(payload.code, payload.message ?? fallback);
        baseShow(mapped, "error", options);
        return;
      }

      const derivedMessage =
        typeof input === "string"
          ? input
          : input instanceof Error
            ? input.message
            : fallback;

      const mappedMessage =
        typeof input === "object" && input && "code" in (input as Record<string, unknown>)
          ? mapBackendError(String((input as Record<string, unknown>).code), derivedMessage)
          : derivedMessage;

      baseShow(mappedMessage, "error", options);
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
