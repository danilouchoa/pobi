import { describe, it, expect, vi } from 'vitest';
import { handleBulkJob } from '../src/workers/bulkWorker';
// Mock applyBulkUpdate para simular sucesso
vi.mock('../src/services/bulkUpdateService', () => ({
  applyBulkUpdate: vi.fn().mockResolvedValue({ count: 2 })
}));
describe('handleBulkJob', () => {
  it('deve ACK mensagem em caso de sucesso', async () => {
    const ack = vi.fn();
    const nack = vi.fn();
    const msg = { content: Buffer.from(JSON.stringify({ jobId: '123' })), properties: { headers: {} } };
    const channel = { ack, nack };
    const prisma = {};
    const result = await handleBulkJob({ msg, channel, prisma });
    expect(ack).toHaveBeenCalledWith(msg);
    expect(result).toBe('ack');
  });

  it('deve NACK mensagem em caso de erro', async () => {
    const ack = vi.fn();
    const nack = vi.fn();
    // Mensagem sem jobId para forçar erro
    const msg = { content: Buffer.from(JSON.stringify({})), properties: { headers: {} } };
    const channel = { ack, nack };
    const prisma = {};
    const result = await handleBulkJob({ msg, channel, prisma });
    expect(nack).toHaveBeenCalledWith(msg, false, false);
    expect(result).toBe('nack');
  });
});
