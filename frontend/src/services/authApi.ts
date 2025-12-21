import api from "./api";

// NOTE: Auth UI should consume the BFF client in `features/auth/bff/client.ts`.

export type VerificationUserPayload = {
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
} & Record<string, unknown>;

export type VerifyEmailSuccessResponse = {
  status: "VERIFIED";
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  user?: VerificationUserPayload;
};

export type VerifyEmailErrorCode =
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "RATE_LIMITED"
  | "GENERIC_ERROR";

export type ResendVerificationResponse = {
  status: "RESENT" | "ALREADY_VERIFIED";
};

export async function verifyEmail(token: string): Promise<VerifyEmailSuccessResponse> {
  const { data } = await api.post<VerifyEmailSuccessResponse>("/api/auth/verify-email", { token });
  return data;
}

export async function resendVerification(): Promise<ResendVerificationResponse> {
  const { data } = await api.post<ResendVerificationResponse>("/api/auth/resend-verification");
  return data;
}
