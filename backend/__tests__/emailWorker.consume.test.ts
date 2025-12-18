import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const buildMessage = (payload: any, headers: Record<string, unknown> = {}) =>
  ({
    content: Buffer.from(JSON.stringify(payload)),
    properties: {
      headers,
      messageId: payload.jobId ?? 'job-1',
      correlationId: payload.correlationId ?? 'corr-1',
    },
    fields: {},
  } as any);

describe('startEmailWorker consumption', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('consome fila e envia verificação com ACK', async () => {
    const ack = vi.fn();
    const nack = vi.fn();
    const consumeHandlers: Array<(msg: any) => Promise<void>> = [];

    vi.doMock('../src/lib/rabbit', () => ({
      createRabbit: vi.fn().mockResolvedValue({
        channel: {
          consume: vi.fn((_queue, handler) => consumeHandlers.push(handler)),
          ack,
          nack,
          sendToQueue: vi.fn(),
        },
      }),
    }));

    const sendEmail = vi.fn().mockResolvedValue({ id: 'ok', provider: 'noop' });
    vi.doMock('../src/lib/email', () => ({ sendEmail }));

    const { startEmailWorker } = await import('../src/workers/emailWorker');
    await startEmailWorker();

    expect(consumeHandlers).toHaveLength(1);
    await consumeHandlers[0](buildMessage({
      type: 'VERIFY_EMAIL',
      email: 'consume@test.app',
      verificationUrl: 'http://localhost:5173/auth/verify-email?token=abc',
      userId: 'user-1',
      expiresAt: new Date().toISOString(),
    }));

    expect(sendEmail).toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();
  });

  it('reagenda retry quando envio falha e limita tentativas', async () => {
    const ack = vi.fn();
    const nack = vi.fn();
    const sendToQueue = vi.fn();
    const consumeHandlers: Array<(msg: any) => Promise<void>> = [];

    vi.doMock('../src/lib/rabbit', () => ({
      createRabbit: vi.fn().mockResolvedValue({
        channel: {
          consume: vi.fn((_queue, handler) => consumeHandlers.push(handler)),
          ack,
          nack,
          sendToQueue,
        },
      }),
    }));

    const sendEmail = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce({ id: 'ok', provider: 'noop' });
    vi.doMock('../src/lib/email', () => ({ sendEmail }));

    const { startEmailWorker } = await import('../src/workers/emailWorker');
    await startEmailWorker();

    const jobPayload = {
      type: 'VERIFY_EMAIL',
      email: 'retry@test.app',
      verificationUrl: 'http://localhost:5173/auth/verify-email?token=abc',
      userId: 'user-1',
      expiresAt: new Date().toISOString(),
    };

    await consumeHandlers[0](buildMessage(jobPayload));
    await vi.runOnlyPendingTimersAsync();

    expect(sendToQueue).toHaveBeenCalledTimes(1);
    expect(sendToQueue).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-retry-count': 1 }),
      }),
    );
    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();

    await consumeHandlers[0](buildMessage(jobPayload, { 'x-retry-count': 1 }));
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(ack).toHaveBeenCalledTimes(2);
  });
});
