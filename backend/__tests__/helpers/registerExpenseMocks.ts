import { vi } from 'vitest';

vi.mock('../../src/lib/redisClient', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/lib/redisCache', () => ({
  getOrSetCache: vi.fn(async (_key, fetchFn) => fetchFn()),
}));

vi.mock('../../src/lib/rabbit', () => ({
  publishRecurringJob: vi.fn(async () => undefined),
  publishBulkUpdateJob: vi.fn(async () => undefined),
}));
