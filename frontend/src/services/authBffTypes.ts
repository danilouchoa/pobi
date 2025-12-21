export type AuthBffError = {
  code: string;
  message: string;
  status?: number;
  fieldErrors?: Record<string, string>;
  originalError?: unknown;
};

export type AuthSessionResponse = {
  user: Record<string, unknown>;
  accessToken: string;
};

export type AuthRefreshResponse = {
  user?: Record<string, unknown>;
  accessToken: string;
};

export type AuthMeResponse = {
  user: Record<string, unknown>;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name?: string;
  email: string;
  password: string;
  acceptedTerms?: boolean;
  termsVersion?: string;
};

export type GoogleCredentialRequest = {
  credential: string;
};

export type GoogleResolveConflictRequest = {
  credential: string;
  strategy: "merge_using_google_as_canonical";
};

export type VerifyEmailSuccessResponse = {
  status: "VERIFIED";
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  user?: Record<string, unknown>;
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
