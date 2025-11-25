# Auth Email Verification Flow & Account States (UX-06 Blueprint)

## Summary
Email verification adds a light double opt-in that proves control of the address, raises trust for downstream notifications, and provides an LGPD/GDPR-friendly audit trail (timestamp + IP). It extends the existing UX-01…UX-05 auth foundation without breaking login/sign-up semantics or the httpOnly-cookie model. Unverified users can reach the product with controlled restrictions until verification is complete.

## Account States & Permissions
### States
- **UNVERIFIED**: Minimal sign-up completed; email not yet confirmed.
- **VERIFIED**: Email confirmed; full feature access (respecting plan/consent constraints).
- **REVERIFY_REQUIRED (future-ready)**: Optional future state if email changes or policy demands periodic re-validation.

### UX surfaces & permissions
- **UNVERIFIED**
  - Can log in and see personal finance data already created.
  - Cannot access sensitive/external features (bank connections, exports/downloads, third-party integrations, high-risk mutations); exact gating list to be refined in UX-06E.
  - Persistent reminders in dashboard/banner and auth screens to verify email; CTA to resend verification.
  - Back-end may reply with `EMAIL_NOT_VERIFIED` on gated endpoints; frontend shows friendly guidance without technical jargon.
- **VERIFIED**
  - Full access to all features (subject to plan/consent/security toggles).
  - Banners/reminders removed; integrations and exports unlocked.
- **REVERIFY_REQUIRED (future)**
  - Treated similarly to UNVERIFIED but triggered by email change or security policy.

### Light double opt-in principle
- UNVERIFIED users are allowed into the product to explore core features but are blocked from sensitive/external actions until verification succeeds.
- VERIFICATION completes the opt-in: users must click the verification link; resends are available with rate limits.

## End-to-end Journey: Sign-up ➜ Email ➜ Verify ➜ Post-verify
### a) Sign-up (UX-05)
- User submits minimal form (email, password, optional name) + required `BASIC_TERMS_AND_PRIVACY` consent.
- Backend creates User + consent, issues session (current behavior preserved), generates email verification token, and enqueues email job.

### b) “Check your email” `/auth/check-email`
- Frontend redirects here immediately after successful sign-up instead of dropping directly into the dashboard.
- Content: heading + message to open the inbox, note that the link expires after **N hours (configurable)**, CTA to resend verification email.
- Feedback: success `Alert` on resend; error `Alert` with human guidance for rate limits or other failures. Do **not** reuse the “Sessão expirada” copy.

### c) Verification link `/auth/verify-email?token=...`
- Renders in `AuthShell`; shows “Verificando seu e-mail…” while calling the verification endpoint.
- Outcomes:
  - **Success**: confirmation message + CTA (login or dashboard depending on auth state).
  - **INVALID_TOKEN**: error message + CTA to request new email or contact support.
  - **TOKEN_EXPIRED**: error + CTA to resend (if authenticated) or go to check-email screen.
  - **TOKEN_ALREADY_USED**: if user already verified, treat as success and allow forward navigation; otherwise show guidance to resend.
- Must not trigger the session-expired alert; relies on dedicated error codes.

### d) Post-verification behavior
- If authenticated: update AuthProvider session with `emailVerified`/`emailVerifiedAt`, remove banners, unlock gated features.
- If not authenticated: show success message with CTA to login; do not auto-login via token.

## Backend Contracts (Models, Endpoints, Error Codes)
### Data models (conceptual)
- **User** additions:
  - `emailVerifiedAt: DateTime?`
  - `emailVerifiedIp: string?`
  - (Optional) consent purpose `EMAIL_VERIFIED` recorded when verification succeeds.
- **EmailVerificationToken** fields:
  - `id`, `userId`, `tokenHash`, `expiresAt`, `consumedAt`, `createdAt`, `createdIp`.
  - Indexes: `userId`, `expiresAt` (cleanup).
  - Security: only store hashed token; raw token is opaque, cryptographically strong; TTL via env (e.g., `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`).

### Endpoints
- **`POST /api/auth/verify-email`** (or `GET` with query): accepts raw `token`.
  - Not found → `{ error: "INVALID_TOKEN" }`
  - Expired → `{ error: "TOKEN_EXPIRED" }`
  - Already used → `{ error: "TOKEN_ALREADY_USED" }`
  - Valid → consume token, set `emailVerifiedAt` + `emailVerifiedIp`, return success payload (e.g., `{ emailVerified: true, emailVerifiedAt }`).
- **`POST /api/auth/resend-verification`** (authenticated):
  - If already verified → benign 200 with “already verified” message.
  - If unverified → enforce resend window, create new token, enqueue email, respond 200 with generic success (avoid enumeration).
- **Register integration**: `/api/auth/register` generates verification token and enqueues email on successful sign-up.

### Error code semantics
- Dedicated codes: `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`, and `EMAIL_NOT_VERIFIED` (for gated access).
- Do **not** reuse login/session codes (`INVALID_CREDENTIALS`, `SESSION_EXPIRED`).

### Observability hooks
- Events to log/emit: `auth.verify-email.token-created`, `auth.verify-email.success`, `auth.verify-email.invalid-token`, `auth.verify-email.expired`, `auth.verify-email.already-used`, `auth.verify-email.resend-requested`.

## Frontend Contracts (Routes, Screens, State) Using AuthShell
### Routes
- `/auth/check-email`
- `/auth/verify-email` (token via query or navigation state).

### Screens
- **Check-email** (`/auth/check-email`):
  - Uses `AuthShell` (reuse `variant="signup"` or add `variant="verify"`).
  - Content: heading + short paragraph about verification; button to resend; `Alert` for success/error feedback.
- **Verify-email** (`/auth/verify-email`):
  - Uses `AuthShell`; on mount, calls verify endpoint.
  - States: loading → success/error variants per error codes with CTAs to login, dashboard, or resend.

### AuthProvider integration
- Session shape should expose `emailVerified: boolean` or `emailVerifiedAt: string | null`.
- `/api/auth/me` response maps to this shape; UI (banners/actions) reads it to adjust copy and gating.

### UI/UX notes
- Use only Auth Design System primitives (`Card`, `Button`, `TextField`, `FormField`, `Alert`, `ThemeProvider`, `AuthShell`).
- Mobile-first layout, accessible headings/aria-live for alerts, focus handling; avoid the “Sessão expirada” message in this flow.

## Access Rules for Unverified Accounts (Policy-level)
### Product rule proposal
- **UNVERIFIED**:
  - Can use core personal-finance features (record income/expenses, view dashboard).
  - Cannot access integrations (bank/fintech connections), exports/downloads, or other high-risk operations until verified.
- **VERIFIED**:
  - Full access including integrations/exports.

### Backend enforcement pattern
- Middleware for sensitive endpoints checks `user.emailVerifiedAt`; if missing, return `403 { error: "EMAIL_NOT_VERIFIED", message: "Você precisa verificar seu e-mail para acessar este recurso." }`.

### Frontend enforcement pattern
- Dashboard banner when `emailVerifiedAt` is null with friendly reminder + “Enviar e-mail de verificação” button.
- On 403 `EMAIL_NOT_VERIFIED`, show clear message and CTA to `/auth/check-email` or trigger resend inline.

## Auth & Email Verification as a Bounded Context (Microservices View)
- Auth bounded context owns users, sessions, consents, and email verification tokens.
- Email sending stays async via RabbitMQ: Auth publishes `VERIFY_EMAIL` jobs to an email queue; worker/email-service consumes and calls provider (e.g., Resend).
- Contracts remain stable if Auth becomes a microservice and email moves to a dedicated notifier; verification token persistence stays within Auth.

## Backlog for UX-06B…UX-06F
- **UX-06B – Backend: data model & token service**
  - Prisma schema changes for `emailVerifiedAt/emailVerifiedIp` and `EmailVerificationToken` model; hashing + TTL service; unit tests for token lifecycle.
- **UX-06C – Backend: verify/resend endpoints & email queue**
  - Integrate token creation into `/api/auth/register`; implement `/api/auth/verify-email` and `/api/auth/resend-verification`; publish RabbitMQ email jobs; integration tests covering register/verify/resend.
- **UX-06D – Frontend: Check-email & Verify-email screens**
  - Add routes/screens using `AuthShell`; API client helpers; AuthProvider state integration; UI tests for success/error states.
- **UX-06E – Access rules for unverified users**
  - Backend middleware for `EMAIL_NOT_VERIFIED`; frontend banner + error handling; tests for gating in both layers.
- **UX-06F – Observability, toggles & documentation**
  - Logging events, feature flags/toggles, TTL/resend windows via env vars; finalize documentation of the email verification bounded context.
