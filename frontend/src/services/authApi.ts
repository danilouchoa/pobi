import api from "./api";

export type VerifyEmailSuccessResponse = {
  status: "VERIFIED";
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  user?: Record<string, unknown> & { emailVerifiedAt?: string | null; emailVerified?: boolean };
};

export type VerifyEmailResponse = VerifyEmailSuccessResponse;

export type ResendVerificationResponse = {
  status: "RESENT" | "ALREADY_VERIFIED";
};

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const { data } = await api.post<VerifyEmailResponse>("/api/auth/verify-email", { token });
  return data;
}

export async function resendVerification(): Promise<ResendVerificationResponse> {
  const { data } = await api.post<ResendVerificationResponse>("/api/auth/resend-verification");
  return data;
}
