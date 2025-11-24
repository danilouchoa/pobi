// Mock Prisma Client para testes (Vitest)
import { vi } from 'vitest';

export const prisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userConsent: {
    create: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  // Adicione outros modelos conforme necessário
};

export default prisma;
