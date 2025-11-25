import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEmailJob } from '../src/workers/emailWorker';
import { sendEmail } from '../src/lib/email';

vi.mock('../src/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'test-email' }),
}));

describe('emailWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseJob = {
    type: 'VERIFY_EMAIL' as const,
    email: 'worker@test.app',
    verificationUrl: 'http://localhost:5173/auth/verify-email?token=abc',
    userId: 'user-1',
    expiresAt: new Date().toISOString(),
  };

  it('processa job válido de verificação', async () => {
    const result = await handleEmailJob(baseJob);

    expect(result).toEqual({ ack: true, handled: true });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'worker@test.app',
      subject: 'Confirme seu e-mail no Finfy',
    }));
  });

  it('descarta payload inválido sem tentar enviar', async () => {
    const result = await handleEmailJob({ type: 'VERIFY_EMAIL' });

    expect(result).toEqual({ ack: true, handled: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('marca para reprocessar quando envio falha', async () => {
    (sendEmail as unknown as vi.Mock).mockRejectedValueOnce(new Error('provider down'));

    const result = await handleEmailJob(baseJob);

    expect(result).toEqual({ ack: false, handled: true });
  });
});
