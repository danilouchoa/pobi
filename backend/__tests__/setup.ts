import { vi, beforeAll, afterEach, afterAll } from 'vitest';

// Configurar ambiente de teste ANTES de qualquer import do app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = 'mongodb://localhost:27017/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.RABBITMQ_URL = 'amqp://localhost';

// Mock do Prisma Client como classe
const mockPrismaInstance = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  origin: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  debtor: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  salaryHistory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  job: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $disconnect: vi.fn(),
  $connect: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      return mockPrismaInstance;
    }
  },
}));

// Mock do Redis Client
vi.mock('../src/lib/redisClient', () => ({
  redisClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    flushDb: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    isReady: true,
  },
}));

// Mock do RabbitMQ
vi.mock('../src/lib/rabbit', () => ({
  publishToQueue: vi.fn().mockResolvedValue(undefined),
  publishRecurringJob: vi.fn().mockResolvedValue(undefined),
  consumeQueue: vi.fn(),
  createRabbit: vi.fn().mockResolvedValue({
    channel: {
      sendToQueue: vi.fn(),
      assertQueue: vi.fn(),
      consume: vi.fn(),
    },
    connection: {
      close: vi.fn(),
    },
  }),
  getChannel: vi.fn(() => ({
    sendToQueue: vi.fn(),
    assertQueue: vi.fn(),
    consume: vi.fn(),
  })),
}));

// Mock process.exit para evitar que testes terminem o processo
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
  throw new Error(`process.exit(${code})`);
});

// Mock global clock (UTC fixo)
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
});

// Seed determinístico global
process.env.TEST_SEED = '42';

// Resetar mocks após cada teste
afterEach(() => {
  vi.clearAllMocks();
});

// Limpar timers após todos os testes
afterAll(() => {
  vi.useRealTimers();
});
