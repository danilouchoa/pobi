# Finance App Frontend

This frontend consumes the REST API exposed by `VITE_API_URL` (default `http://localhost:4000`). React Query v5 orchestrates all remote state, with runtime validation and optimistic flows tuned for month-to-month navigation.

## React Query setup
- Every query/mutation uses `queryKey` objects when cancelling or invalidating.
- `keepPreviousData`, `placeholderData`, and `staleTime` keep the UI stable when the reference month changes.
- Expense mutations (create/update/delete) run fully optimistic, revert on failure, and fall back to a server refresh via `invalidateQueries` on settle.
- React Query DevTools are automatically mounted in development builds to simplify diagnostics.

## API client & auth hardening
- `api.ts` attaches `Authorization: Bearer <token>` whenever an auth token exists.
- HTTP 401 responses now purge the cached token (localStorage + in-memory) and trigger the global unauthorized handler so the user is redirected to the login screen.
- Responses are validated through [Zod](https://zod.dev); corrupted payloads fail fast before poisoning the query cache.

## Runtime schemas
All REST responses pass through Zod schemas (`src/lib/schemas.ts`). The schemas normalize optional fields (e.g. nullable IDs, installments, shared amounts) so hooks/components can rely on consistent shapes without defensive checks.

## Migration blueprint: LocalStorage ➜ REST
1. **Read-first** – gradually swap direct `localStorage` reads for `useExpenses/useCatalogs/useSalary` selectors so components depend on React Query only.
2. **Write-through** – route create/edit/delete flows via mutations (already wired with optimistic updates) to keep the UI responsive.
3. **Feature flag** – introduce an env toggle such as `VITE_USE_REST=true` to gate REST usage while legacy storage is still around. Flip it off to fall back when migrating feature-by-feature.
4. **Cleanup** – once the flag stays on, remove bespoke providers, reducers, or helper abstractions that existed solely for `localStorage` synchronization.

## Smoke tests
Run these endpoints (replace the month when necessary) to verify the backend contract quickly:
```sh
# Expenses
curl -i "$VITE_API_URL/expenses"

# Salary history
curl -i "$VITE_API_URL/salaryHistory?month=2025-11"

# Catalogs
curl -i "$VITE_API_URL/origins"
curl -i "$VITE_API_URL/debtors"
```

## Getting started
```sh
cd frontend
cp .env.example .env # define VITE_API_URL / VITE_USE_REST when needed
npm install
npm run dev
```
