import { vi } from 'vitest';

// Mock global clock (UTC fixo)
vi.useFakeTimers();
vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

// Seed determinístico global
process.env.TEST_SEED = '42';

// Resetar mocks antes de cada teste
afterEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
});
