import axios, { AxiosError } from "axios";

/**
 * API Client - Milestone #13: httpOnly Cookies
 * 
 * Configuração:
 * - withCredentials: true → envia cookies em requests cross-origin
 * - Authorization header com access token (15min)
 * - Cookies httpOnly gerenciados pelo browser automaticamente
 * 
 * Segurança:
 * - Access token em memória (não em localStorage)
 * - Refresh token em cookie httpOnly (inacessível via JS)
 * - CORS configurado para aceitar credentials
 */

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
  /**
   * withCredentials: true é ESSENCIAL para cookies httpOnly
   * Permite browser enviar cookies em requests cross-origin
   * Backend CORS deve ter credentials: true também
   */
  withCredentials: true,
});

// Interceptor: Adiciona Authorization header com access token
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Interceptor: Trata 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Access token expirado → handler tentará refresh
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
