import { format } from 'date-fns';
import { redis } from '../lib/redisClient';

export type ExpenseViewMode = 'calendar' | 'billing';

export const buildExpenseCacheKey = (
  userId: string,
  monthKey: string,
  mode: ExpenseViewMode,
  page: number,
  limit: number
) => `finance:expenses:${mode}:${userId}:${monthKey}:p${page}:l${limit}`;

export const buildCachePattern = (userId: string, monthKey: string, mode: ExpenseViewMode) =>
  `finance:expenses:${mode}:${userId}:${monthKey}:*`;

export const monthKeyFromInput = (input?: string | Date | null) => {
  if (!input) return null;
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'yyyy-MM');
};

type RedisWithScan = typeof redis & {
  scan?: (
    cursor: number | string,
    options?: { match?: string; count?: number }
  ) => Promise<[number | string, string[]]>;
  keys?: (pattern: string) => Promise<string[]>;
};

export async function deleteByPattern(pattern: string) {
  const client = redis as RedisWithScan;

  if (typeof client.scan === 'function') {
    let cursor: number = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, { match: pattern, count: 200 });
      if (Array.isArray(keys) && keys.length) {
        await redis.del(...keys);
      }
      cursor =
        typeof nextCursor === 'string' ? Number.parseInt(nextCursor, 10) || 0 : Number(nextCursor);
    } while (cursor !== 0);
    return;
  }

  if (typeof client.keys === 'function') {
    const keys = await client.keys(pattern);
    if (Array.isArray(keys) && keys.length) {
      await redis.del(...keys);
    }
  }
}

export async function invalidateExpenseCache(
  userId: string,
  entries: Array<{ month: string | null | undefined; mode: ExpenseViewMode }>
) {
  for (const entry of entries) {
    if (!entry.month) continue;
    const pattern = buildCachePattern(userId, entry.month, entry.mode);
    await deleteByPattern(pattern);
  }
}

export const buildInvalidationEntries = (
  calendarMonth?: string | null,
  billingMonth?: string | null
) => [
  { month: calendarMonth ?? null, mode: 'calendar' as ExpenseViewMode },
  { month: billingMonth ?? null, mode: 'billing' as ExpenseViewMode },
];
