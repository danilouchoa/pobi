import { AxiosError } from "axios";

export type LoginErrorKind = "NONE" | "INVALID_CREDENTIALS" | "NETWORK" | "SERVER" | "UNKNOWN";

export type LoginErrorState = {
  kind: LoginErrorKind;
  message: string | null;
};

export const LOGIN_ERROR_MESSAGES: Record<Exclude<LoginErrorKind, "NONE">, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
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

  if (status === 401 && payload?.error === "INVALID_CREDENTIALS") {
    return {
      kind: "INVALID_CREDENTIALS",
      message: LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS,
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
  kind === "NETWORK" || kind === "SERVER" || kind === "UNKNOWN";
