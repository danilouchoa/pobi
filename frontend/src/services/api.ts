import axios, { AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "finance_token";
const hasLocalStorage = typeof localStorage !== "undefined";

let authToken: string | null = hasLocalStorage ? localStorage.getItem(TOKEN_KEY) : null;
let unauthorizedHandler: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (!hasLocalStorage) return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const registerUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      authToken = null;
      if (hasLocalStorage) {
        localStorage.removeItem(TOKEN_KEY);
      }
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
