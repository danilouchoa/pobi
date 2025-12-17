import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

const resendSendMock = vi.fn();
const resendCtor = vi.fn();

class ResendMock {
  emails = { send: resendSendMock };

  constructor(apiKey?: string) {
    resendCtor(apiKey);
  }
}

vi.mock('resend', () => ({
  Resend: ResendMock,
}));

const loadEmailModule = async (overrides: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
    JWT_SECRET: overrides.JWT_SECRET ?? 'test-secret-key',
    DATABASE_URL: overrides.DATABASE_URL ?? 'mongodb://localhost:27017/test_db',
    FRONTEND_ORIGIN: overrides.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    GOOGLE_CLIENT_ID: overrides.GOOGLE_CLIENT_ID ?? 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: overrides.GOOGLE_CLIENT_SECRET ?? 'test-google-client-secret',
    AUTH_EMAIL_PROVIDER: overrides.AUTH_EMAIL_PROVIDER,
    AUTH_EMAIL_FROM: overrides.AUTH_EMAIL_FROM,
    RESEND_FROM: overrides.RESEND_FROM,
    RESEND_API_KEY: overrides.RESEND_API_KEY,
    RABBIT_URL: overrides.RABBIT_URL ?? 'amqp://localhost',
  };

  const emailModule = await import('../src/lib/email');
  return emailModule;
};

afterEach(() => {
  process.env = { ...originalEnv };
  resendSendMock.mockReset();
  resendCtor.mockClear();
  vi.resetModules();
});

describe('email provider selection', () => {
  it('usa provider noop sem chamar Resend', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { sendEmail } = await loadEmailModule({ AUTH_EMAIL_PROVIDER: 'noop' });
    const result = await sendEmail({ to: 'noop@test.app', subject: 'Hello' });

    expect(result.provider).toBe('noop');
    expect(resendCtor).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('falha rápido quando provider é Resend sem API key', async () => {
    const { sendEmail } = await loadEmailModule({
      AUTH_EMAIL_PROVIDER: 'resend',
      AUTH_EMAIL_FROM: 'Finfy <no-reply@finance.app>',
      RESEND_API_KEY: '',
    });

    await expect(sendEmail({ to: 'fail@test.app', subject: 'Hello' })).rejects.toThrow(
      'RESEND_API_KEY is required when AUTH_EMAIL_PROVIDER=resend',
    );
  });

  it('envia usando Resend quando configurado', async () => {
    resendSendMock.mockResolvedValueOnce({ data: { id: 'resend-123' } });
    const { sendEmail } = await loadEmailModule({
      AUTH_EMAIL_PROVIDER: 'resend',
      AUTH_EMAIL_FROM: 'Finfy <no-reply@finance.app>',
      RESEND_API_KEY: 'rk_test_123',
    });

    const result = await sendEmail({
      to: 'ok@test.app',
      subject: 'Verify your email',
      text: 'body',
    });

    expect(resendCtor).toHaveBeenCalledWith('rk_test_123');
    expect(resendSendMock).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Finfy <no-reply@finance.app>',
      to: 'ok@test.app',
      subject: 'Verify your email',
    }));
    expect(result).toMatchObject({ id: 'resend-123', provider: 'resend' });
  });
});
