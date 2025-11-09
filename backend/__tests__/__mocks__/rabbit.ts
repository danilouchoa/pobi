// Mock RabbitMQ para testes (Vitest)
import { vi } from 'vitest';

export const rabbit = {
  publish: vi.fn(),
  consume: vi.fn(),
  ack: vi.fn(),
  nack: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
};

export default rabbit;
