import { vi, beforeAll, afterEach, afterAll } from 'vitest';

// Configurar ambiente de teste ANTES de qualquer import do app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = 'mongodb://localhost:27017/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.RABBIT_URL = 'amqp://localhost';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_DOMAIN = 'localhost';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.AUTH_GOOGLE_ENABLED = 'true';
process.env.AUTH_ACCOUNT_LINK_ENABLED = 'true';

// Mock do Prisma Client como classe
const mockPrismaInstance = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userConsent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  origin: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  debtor: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  salaryHistory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  job: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  $disconnect: vi.fn(),
  $connect: vi.fn(),
};

mockPrismaInstance.$transaction = vi.fn(async (callback: any) => {
  if (typeof callback === 'function') {
    return callback(mockPrismaInstance);
  }
  return callback;
});

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      return mockPrismaInstance;
    }
  },
  // Adiciona enum Provider usado no código de autenticação Google
  Provider: {
    LOCAL: 'LOCAL',
    GOOGLE: 'GOOGLE',
  },
}));

// Mock do Redis Client (nome da exportação é 'redis')
vi.mock('../src/lib/redisClient', () => {
  const redis = {
    // Métodos básicos usados em cache/health
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(0),
    // Métodos opcionais usados para invalidação por padrão
    scan: vi.fn().mockResolvedValue([0, []] as [number, string[]]),
    keys: vi.fn().mockResolvedValue([] as string[]),
    // Compat helpers do ambiente
    connect: vi.fn(),
    disconnect: vi.fn(),
    flushDb: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    isReady: true,
  } as any;
  return { redis };
});

// Mock do RabbitMQ
vi.mock('../src/lib/rabbit', () => ({
  publishToQueue: vi.fn().mockResolvedValue(undefined),
  publishRecurringJob: vi.fn().mockResolvedValue(undefined),
  publishEmailJob: vi.fn().mockResolvedValue(undefined),
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
