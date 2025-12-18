import { describe, it, expect, vi } from 'vitest';
import { handleRecurringJob } from '../src/workers/recurringWorker';
// Mock processRecurringExpenses para simular sucesso e erro
vi.mock('../src/services/recurringService', () => ({
  processRecurringExpenses: vi.fn().mockResolvedValue('ok')
}));
describe('handleRecurringJob', () => {
  it('deve ACK mensagem em caso de sucesso', async () => {
    const ack = vi.fn();
    const nack = vi.fn();
    const msg = { content: Buffer.from(JSON.stringify({})), properties: { headers: {} } };
    const channel = { ack, nack };
    const prisma = {};
    const result = await handleRecurringJob({ msg, channel, prisma });
    expect(ack).toHaveBeenCalledWith(msg);
    expect(result).toBe('ack');
  });

  it('deve NACK mensagem em caso de erro', async () => {
    const ack = vi.fn();
    const nack = vi.fn();
    // Mensagem inválida para forçar erro
    const msg = { content: Buffer.from('invalid json'), properties: { headers: {} } };
    const channel = { ack, nack };
    const prisma = {};
    const result = await handleRecurringJob({ msg, channel, prisma });
    expect(nack).toHaveBeenCalledWith(msg, false, false);
    expect(result).toBe('nack');
  });
});
