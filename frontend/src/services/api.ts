import axios, { AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

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
    if (status !== 401) {
      return Promise.reject(error);
    }

    const url = error.config?.url ?? "";

    const isAuthEndpoint =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/register") ||
      url.includes("/api/auth/refresh");

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
