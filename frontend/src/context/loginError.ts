import { AxiosError } from "axios";

export type LoginErrorKind =
  | "NONE"
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "NETWORK"
  | "SERVER"
  | "UNKNOWN";

export type LoginErrorState = {
  kind: LoginErrorKind;
  message: string | null;
};

export const LOGIN_ERROR_MESSAGES: Record<Exclude<LoginErrorKind, "NONE">, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  SESSION_EXPIRED: "Sessão expirada. Faça login novamente.",
  NETWORK: "Falha de conexão com o servidor. Verifique se o backend está em execução.",
  SERVER: "Ocorreu um erro inesperado. Tente novamente em alguns instantes.",
  UNKNOWN: "Não foi possível concluir o login. Tente novamente.",
};

export const initialLoginErrorState: LoginErrorState = {
  kind: "NONE",
  message: null,
};

type BackendError = {
  error?: string;
  message?: string;
};

export function mapLoginError(error: unknown): LoginErrorState {
  const axiosError = error as AxiosError<BackendError>;

  if (!axiosError?.response) {
    return {
      kind: "NETWORK",
      message: LOGIN_ERROR_MESSAGES.NETWORK,
    };
  }

  const status = axiosError.response.status ?? 0;
  const payload = axiosError.response.data;
  const payloadError = payload?.error;
  const payloadMessage = payload?.message ?? "";
  const normalizedMessage = typeof payloadMessage === "string" ? payloadMessage.toLowerCase() : "";

  if (status === 401 && payloadError === "INVALID_CREDENTIALS") {
    return {
      kind: "INVALID_CREDENTIALS",
      message: LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS,
    };
  }

  const isSessionExpired =
    status === 419 ||
    status === 440 ||
    (status === 401 &&
      [
        "SESSION_EXPIRED",
        "INVALID_REFRESH_TOKEN",
        "INVALID_TOKEN_PAYLOAD",
        "NO_REFRESH_TOKEN",
      ].includes(payloadError ?? "")) ||
    normalizedMessage.includes("sessão expirada");

  if (isSessionExpired) {
    return {
      kind: "SESSION_EXPIRED",
      message: LOGIN_ERROR_MESSAGES.SESSION_EXPIRED,
    };
  }

  if (status >= 500 || payload?.error === "INTERNAL_ERROR") {
    return {
      kind: "SERVER",
      message: LOGIN_ERROR_MESSAGES.SERVER,
    };
  }

  return {
    kind: "UNKNOWN",
    message: payload?.message ?? LOGIN_ERROR_MESSAGES.UNKNOWN,
  };
}

export const isGlobalLoginError = (kind: LoginErrorKind) =>
  kind === "NETWORK" || kind === "SERVER" || kind === "UNKNOWN" || kind === "SESSION_EXPIRED";
