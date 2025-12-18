# UX-09A – Cache Consistency & Immediate UI Updates for Expenses

## Backend
- **Cache keys**: `finance:expenses:{mode}:{userId}:{yyyy-MM}:p{page}:l{limit}` (modes: `calendar` | `billing`).
- **Storage**: Redis (node-redis) or Upstash; TTL controlled by `EXPENSES_CACHE_TTL_SECONDS` (default 3600).
- **Feature flag**: `EXPENSES_CACHE_ENABLED` (default true). When disabled, GET /api/expenses bypasses Redis and queries Prisma directly.
- **Invalidation strategy**: `invalidateExpenseCache()` builds patterns per month/mode and calls `deleteByPattern()` which SCANs with MATCH/COUNT, deletes in chunks (500), guards infinite loops, and logs `[CACHE INVALIDATE] pattern=... deletedKeys=...` when `CACHE_DEBUG=true`.
- **HTTP caching**: `/api/expenses*` responses set `Cache-Control: private, no-store` + `Pragma: no-cache` to avoid browser/proxy caching.

## Frontend
- **Query key shape**: `['expenses','list',{ month, mode, page, limit }]` (plus `month/recurring/shared` variants). Multiple variants (e.g., limit 20 vs 1000) may coexist.
- **Optimistic updates**: Mutations apply to all cached list variants for the same month/mode via `setQueriesData` predicates; rollbacks restore snapshots per query.
- **Invalidation/refetch**: Targeted invalidation/refetch for the current month/mode using query predicates; recurring/shared keys also invalidated.
- **DELETE 404 handling**: Treated as idempotent success—no rollback; triggers invalidate/refetch to drop stale items when the backend already removed the record.

## Verification checklist
- Create expense → item appears immediately in dashboard; backend logs show `[CACHE MISS] ... → stored` after mutation.
- Delete expense → item disappears immediately; repeated delete returns 404 but UI stays clean.
- After logout/login, no ghost expenses remain; cache repopulates from server.
- With `CACHE_DEBUG=true`, see `[CACHE INVALIDATE] pattern=... deletedKeys=N` after mutations.
