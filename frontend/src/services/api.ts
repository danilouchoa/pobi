import axios, { AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const EMAIL_NOT_VERIFIED_MESSAGE =
  "Para usar esta funcionalidade, você precisa confirmar seu e-mail. Enviamos um link para sua caixa de entrada.";

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let emailNotVerifiedHandler: ((payload: { message: string; redirectPath: string }) => void) | null = null;

/**
 * Define access token em memória
 * IMPORTANTE: Não persiste em localStorage (vulnerável a XSS)
 */
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

/**
 * Registra callback para lidar com 401 (token expirado)
 */
export const registerUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler;
};

export const registerEmailNotVerifiedHandler = (
  handler: ((payload: { message: string; redirectPath: string }) => void) | null
) => {
  emailNotVerifiedHandler = handler;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Interceptor: Adiciona Authorization header com access token
api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Interceptor: Trata 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = (error.response?.data ?? {}) as { error?: string; message?: string };

    if (status === 403 && data?.error === "EMAIL_NOT_VERIFIED") {
      const friendlyMessage = data.message || EMAIL_NOT_VERIFIED_MESSAGE;
      const redirectPath = "/auth/check-email";
      emailNotVerifiedHandler?.({ message: friendlyMessage, redirectPath });

      const wrappedError = new Error(friendlyMessage) as Error & {
        code: "EMAIL_NOT_VERIFIED";
        redirectPath: string;
        originalError: AxiosError;
      };
      wrappedError.code = "EMAIL_NOT_VERIFIED";
      wrappedError.redirectPath = redirectPath;
      wrappedError.originalError = error;

      return Promise.reject(wrappedError);
    }

    if (status !== 401) {
      return Promise.reject(error);
    }

    const url = error.config?.url ?? "";

    const isAuthEndpoint =
      url.includes("/api/auth/") ||
      url.includes("/api/bff/auth/");

    if (!authToken) {
      return Promise.reject(error);
    }

    if (!isAuthEndpoint) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  }
);

export default api;
