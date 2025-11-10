import { vi } from 'vitest';

vi.mock('../../src/lib/redisClient', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    scan: vi.fn().mockResolvedValue([0, []]),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../src/lib/redisCache', () => ({
  getOrSetCache: vi.fn(async (_key, fetchFn) => fetchFn()),
}));

vi.mock('../../src/lib/rabbit', () => ({
  publishRecurringJob: vi.fn(async () => undefined),
  publishBulkUpdateJob: vi.fn(async () => undefined),
}));
