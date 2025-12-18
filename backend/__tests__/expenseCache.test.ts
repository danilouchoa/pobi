import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config', () => ({
  config: {
    cacheDebugEnabled: false,
    expensesCacheEnabled: true,
    expensesCacheTtlSeconds: 3600,
  },
}));

const scanMock = vi.fn();
const delMock = vi.fn();
const keysMock = vi.fn();

vi.mock('../src/lib/redisClient', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: (...args: string[]) => delMock(...args),
    scan: (...args: any[]) => scanMock(...args),
    keys: (...args: any[]) => keysMock(...args),
    ping: vi.fn(),
  },
}));

import { deleteByPattern, invalidateExpenseCache } from '../src/utils/expenseCache';

const resetMocks = () => {
  scanMock.mockReset();
  delMock.mockReset();
  keysMock.mockReset();
};

describe('expenseCache.deleteByPattern', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('deletes keys returned by scan with string cursor', async () => {
    const keys = Array.from({ length: 1200 }, (_, i) => `k${i}`);
    scanMock.mockResolvedValueOnce(['0', keys]);
    delMock.mockResolvedValue(1);

    const deleted = await deleteByPattern('finance:expenses:*');

    expect(deleted).toBe(3); // 1200 keys -> 3 chunks of 500/500/200
    expect(delMock).toHaveBeenCalledTimes(3);
    expect(scanMock).toHaveBeenCalledWith('0', { match: 'finance:expenses:*', count: 200 });
  });

  it('terminates when scan returns numeric cursor and deletes chunk', async () => {
    scanMock
      .mockResolvedValueOnce([1, ['k1']])
      .mockResolvedValueOnce([0, []]);
    delMock.mockResolvedValue(1);

    const deleted = await deleteByPattern('finance:expenses:*');

    expect(deleted).toBe(1);
    expect(scanMock).toHaveBeenCalledTimes(2);
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it('guards against non-advancing cursor to avoid infinite loop', async () => {
    scanMock.mockImplementation(() => Promise.resolve(['1', []]));

    const deleted = await deleteByPattern('finance:expenses:*');

    expect(deleted).toBe(0);
    expect(scanMock).toHaveBeenCalled();
    // Should break once cursor stops advancing
    expect(scanMock.mock.calls.length).toBe(2);
  });
});

describe('expenseCache.invalidateExpenseCache', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('builds patterns per entry and deletes matches', async () => {
    scanMock.mockResolvedValue(['0', ['a', 'b']]);
    delMock.mockResolvedValue(2);

    await invalidateExpenseCache('user-1', [
      { month: '2025-12', mode: 'calendar' },
      { month: '2025-12', mode: 'billing' },
    ]);

    expect(scanMock).toHaveBeenCalledTimes(2);
    expect(delMock).toHaveBeenCalledTimes(2);
    expect(scanMock.mock.calls[0][1]).toMatchObject({ match: 'finance:expenses:calendar:user-1:2025-12:*' });
    expect(scanMock.mock.calls[1][1]).toMatchObject({ match: 'finance:expenses:billing:user-1:2025-12:*' });
  });
});
