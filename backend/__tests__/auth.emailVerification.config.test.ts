import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../src/index';
import { config } from '../src/config';
import { publishEmailJob } from '../src/lib/rabbit';
import * as emailVerificationService from '../src/services/emailVerification';
import { getPrismaMock, loginTestUser } from './helpers/expenseTestUtils';

const prisma = getPrismaMock();

describe('Auth email verification feature toggles', () => {
  const originalEnqueueEnabled = config.emailVerificationEnqueueEnabled;
  const originalRequired = config.emailVerificationRequired;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    config.emailVerificationEnqueueEnabled = originalEnqueueEnabled;
    config.emailVerificationRequired = originalRequired;
  });

  it('skips enqueue when AUTH_EMAIL_VERIFICATION_ENQUEUE_ENABLED=false and still responds RESENT', async () => {
    config.emailVerificationEnqueueEnabled = false;

    const tokenSpy = vi
      .spyOn(emailVerificationService, 'createEmailVerificationToken')
      .mockResolvedValue({ rawToken: 'token-123', expiresAt: new Date(), tokenId: 'evt-1' });
    vi.spyOn(emailVerificationService, 'canIssueNewToken').mockResolvedValue({
      allowed: true,
      reason: 'no_recent_token',
    });

    const auth = await loginTestUser();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', email: 'user@test.app', emailVerifiedAt: null });
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESENT');
    expect(publishEmailJob).not.toHaveBeenCalled();
    expect(tokenSpy).toHaveBeenCalled();
  });

  it('bypasses email verification gate when AUTH_EMAIL_VERIFICATION_REQUIRED=false', async () => {
    config.emailVerificationRequired = false;
    const auth = await loginTestUser();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', emailVerifiedAt: null });
    prisma.job.findFirst.mockResolvedValue({ id: 'job-1', userId: 'user-123', status: 'done' });

    const res = await request(app)
      .get('/api/jobs/job-1/status')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('job-1');
  });

  it('logs invalid token events with structured logger', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(emailVerificationService, 'consumeToken').mockResolvedValue({ status: emailVerificationService.EmailVerificationTokenStatus.NotFound });

    const res = await request(app).post('/api/auth/verify-email').send({ token: 'invalid-token' });

    expect(res.status).toBe(400);
    const hasInvalidLog = consoleSpy.mock.calls.some((call) => String(call[0]).includes('auth.verify-email.invalid-token'));
    expect(hasInvalidLog).toBe(true);
    consoleSpy.mockRestore();
  });
});
