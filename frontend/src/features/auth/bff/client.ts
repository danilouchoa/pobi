import type { AxiosError } from "axios";
import api from "../../../services/api";
import type {
  AuthBffError,
  AuthMeResponse,
  AuthRefreshResponse,
  AuthSessionResponse,
  GoogleCredentialRequest,
  GoogleResolveConflictRequest,
  LoginRequest,
  RegisterRequest,
  ResendVerificationResponse,
  VerifyEmailSuccessResponse,
} from "./types";

const AUTH_BFF_BASE = "/api/bff/auth";

type BackendErrorPayload = {
  error?: string;
  message?: string;
  errors?: Record<string, string>;
};

export const toAuthBffError = (error: unknown): AuthBffError => {
  const axiosError = error as AxiosError<BackendErrorPayload>;
  const status = axiosError.response?.status;
  const data = axiosError.response?.data;

  return {
    code: data?.error ?? "UNKNOWN",
    message: data?.message ?? axiosError.message ?? "Erro inesperado.",
    status,
    fieldErrors: data?.errors,
    originalError: error,
  };
};

export const authBff = {
  async login(payload: LoginRequest): Promise<AuthSessionResponse> {
    const { data } = await api.post<AuthSessionResponse>(`${AUTH_BFF_BASE}/login`, payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<AuthSessionResponse> {
    const { data } = await api.post<AuthSessionResponse>(`${AUTH_BFF_BASE}/register`, payload);
    return data;
  },

  async refresh(): Promise<AuthRefreshResponse> {
    const { data } = await api.post<AuthRefreshResponse>(`${AUTH_BFF_BASE}/refresh`);
    return data;
  },

  async logout(): Promise<void> {
    await api.post(`${AUTH_BFF_BASE}/logout`);
  },

  async me(): Promise<AuthMeResponse> {
    const { data } = await api.get<AuthMeResponse>(`${AUTH_BFF_BASE}/me`);
    return data;
  },

  async googleLogin(payload: GoogleCredentialRequest): Promise<AuthSessionResponse> {
    const { data } = await api.post<AuthSessionResponse>(`${AUTH_BFF_BASE}/google`, payload);
    return data;
  },

  async googleResolveConflict(payload: GoogleResolveConflictRequest): Promise<AuthSessionResponse> {
    const { data } = await api.post<AuthSessionResponse>(`${AUTH_BFF_BASE}/google/resolve-conflict`, payload);
    return data;
  },

  async linkGoogle(payload: GoogleCredentialRequest): Promise<AuthSessionResponse> {
    const { data } = await api.post<AuthSessionResponse>(`${AUTH_BFF_BASE}/link/google`, payload);
    return data;
  },

  async verifyEmail(token: string): Promise<VerifyEmailSuccessResponse> {
    const { data } = await api.post<VerifyEmailSuccessResponse>(`${AUTH_BFF_BASE}/verify-email`, { token });
    return data;
  },

  async resendVerification(): Promise<ResendVerificationResponse> {
    const { data } = await api.post<ResendVerificationResponse>(`${AUTH_BFF_BASE}/resend-verification`);
    return data;
  },
};
