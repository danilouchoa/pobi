import { format } from 'date-fns';
import { config } from '../config';
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

const CACHE_DEBUG_ENABLED = config.cacheDebugEnabled;
const DELETE_CHUNK_SIZE = 500;
const SCAN_COUNT = 200;
const MAX_SCAN_ITERATIONS = 10_000;

const deleteInChunks = async (keys: string[]) => {
  let deleted = 0;
  for (let i = 0; i < keys.length; i += DELETE_CHUNK_SIZE) {
    const slice = keys.slice(i, i + DELETE_CHUNK_SIZE);
    deleted += await redis.del(...slice);
  }
  return deleted;
};

export async function deleteByPattern(pattern: string) {
  const client = redis as RedisWithScan;
  let deletedCount = 0;

  if (typeof client.scan === 'function') {
    let cursor: string = '0';
    let iterations = 0;

    do {
      const [nextCursorRaw, keys] = await client.scan(cursor, { match: pattern, count: SCAN_COUNT });
      const normalizedCursor = String(nextCursorRaw ?? '0');

      if (Array.isArray(keys) && keys.length) {
        deletedCount += await deleteInChunks(keys);
      }

      iterations += 1;

      if (normalizedCursor === cursor || iterations >= MAX_SCAN_ITERATIONS) {
        break;
      }

      cursor = normalizedCursor;
    } while (cursor !== '0');

    if (CACHE_DEBUG_ENABLED) {
      console.log(`[CACHE INVALIDATE] pattern=${pattern} deletedKeys=${deletedCount}`);
    }

    return deletedCount;
  }

  if (typeof client.keys === 'function') {
    const keys = await client.keys(pattern);
    if (Array.isArray(keys) && keys.length) {
      deletedCount += await deleteInChunks(keys);
    }

    if (CACHE_DEBUG_ENABLED) {
      console.log(`[CACHE INVALIDATE] pattern=${pattern} deletedKeys=${deletedCount}`);
    }

    return deletedCount;
  }

  return deletedCount;
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
