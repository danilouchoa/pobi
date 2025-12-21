# Auth boundary (BFF-ready) — UX-08

## Purpose
Create a stable authentication boundary that can be lifted into a dedicated micro frontend or BFF later, without rewiring the main app. The boundary defines **where Auth UI lives**, **how it is routed**, and **how it talks to the backend**.

## Frontend boundary
All auth UI must live under `frontend/src/features/auth/*`:

```
frontend/src/features/auth/
  index.ts
  routes.tsx
  pages/
  components/
  bff/
```

### Route contract (frontend)
Auth is mounted under `/auth/*`:
- `/auth/login`
- `/auth/register`
- `/auth/verify-email`
- `/auth/check-email`

Legacy redirects (kept in the app router):
- `/login` ➜ `/auth/login`
- `/signup` ➜ `/auth/register`
- `/register` ➜ `/auth/register`

### UI rules
- Auth pages must use **only** Design System components from `frontend/src/ui/*`.
- No raw interactive HTML controls (`<input>`, `<button>`, etc.) inside Auth pages/components.

## BFF boundary (frontend client)
Auth pages and auth state must call the backend **only** through:
```
frontend/src/features/auth/bff/client.ts
```

This client wraps the shared Axios instance (`frontend/src/services/api.ts`) to keep interceptors and cookies consistent.

## Backend alias
Backend exposes two equivalent routes:
- `/api/auth/*` (existing)
- `/api/bff/auth/*` (alias for BFF boundary)

The alias **must not** change behavior; it mounts the same router.

## Non-goals
- Not implementing module federation or runtime composition in this phase.
- Not changing auth behavior, tokens, cookies, or validation rules.
