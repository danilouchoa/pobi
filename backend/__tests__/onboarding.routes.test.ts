import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import app from '../src/index';
import { getAuthorizedHeaders, getPrismaMock, loginTestUser } from './helpers/expenseTestUtils';

const prisma = getPrismaMock();

type PreferencesRecord = {
  id: string;
  userId: string;
  countryCode: string | null;
  currencyCode: string | null;
  timezone: string | null;
  display: Record<string, unknown> | null;
  goals: string[];
  onboardingStatus: string;
  onboardingFirstPromptedAt: Date | null;
  onboardingDismissedAt: Date | null;
  onboardingCompletedAt: Date | null;
  step1CompletedAt: Date | null;
  step2CompletedAt: Date | null;
  step3CompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const buildPreferences = (overrides: Partial<PreferencesRecord> = {}): PreferencesRecord => ({
  id: 'pref-1',
  userId: 'user-123',
  countryCode: null,
  currencyCode: null,
  timezone: null,
  display: null,
  goals: [],
  onboardingStatus: 'NOT_STARTED',
  onboardingFirstPromptedAt: null,
  onboardingDismissedAt: null,
  onboardingCompletedAt: null,
  step1CompletedAt: null,
  step2CompletedAt: null,
  step3CompletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

let prefsState = buildPreferences();

const mockUserPreferences = () => {
  prisma.userPreferences.findUnique = vi.fn(async ({ where }: any = {}) => {
    return where?.userId === prefsState.userId ? { ...prefsState } : null;
  });
  prisma.userPreferences.create = vi.fn(async ({ data }: any = {}) => {
    prefsState = buildPreferences({ ...data, goals: data?.goals ?? [] });
    return { ...prefsState };
  });
  prisma.userPreferences.update = vi.fn(async ({ data }: any = {}) => {
    prefsState = { ...prefsState, ...data };
    return { ...prefsState };
  });
};

const mockUserSelect = () => {
  prisma.user.update = vi.fn(async ({ data }: any = {}) => ({
    name: data.name ?? 'Danilo Uchoa',
    avatar: data.avatar ?? null,
  }));
  prisma.user.findUnique = vi.fn(async () => ({
    id: 'user-123',
    email: 'danilo.uchoa@finance.app',
    name: 'Danilo Uchoa',
    avatar: null,
    provider: 'LOCAL',
    googleId: null,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerifiedAt: new Date(),
  }));
};

beforeEach(() => {
  prefsState = buildPreferences();
  mockUserPreferences();
  mockUserSelect();
});

describe('Onboarding routes', () => {
  it('should reject unauthenticated access', async () => {
    const res = await request(app).get('/api/onboarding');
    expect(res.status).toBe(401);
  });

  it('should create preferences on first GET', async () => {
    prisma.userPreferences.findUnique = vi.fn().mockResolvedValueOnce(null);

    const { accessToken } = await loginTestUser();
    const headers = await getAuthorizedHeaders(accessToken);
    const res = await request(app).get('/api/onboarding').set(headers.headers);

    expect(res.status).toBe(200);
    expect(prisma.userPreferences.create).toHaveBeenCalled();
    expect(res.body.preferences.goals).toEqual([]);
  });

  it('should update profile on step 1 and mark completion', async () => {
    const { accessToken } = await loginTestUser();
    const headers = await getAuthorizedHeaders(accessToken);

    const res = await request(app)
      .patch('/api/onboarding')
      .set(headers.headers)
      .send({ name: 'Ana', avatar: 'https://example.com/a.png', markStepCompleted: 1 });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(res.body.profile.name).toBe('Ana');
    expect(res.body.onboarding.step1CompletedAt).not.toBeNull();
  });

  it('should persist preferences on step 2', async () => {
    const { accessToken } = await loginTestUser();
    const headers = await getAuthorizedHeaders(accessToken);

    const res = await request(app)
      .patch('/api/onboarding')
      .set(headers.headers)
      .send({ countryCode: 'BR', currencyCode: 'BRL', timezone: 'America/Sao_Paulo', display: { compactMode: true }, markStepCompleted: 2 });

    expect(res.status).toBe(200);
    expect(res.body.preferences.countryCode).toBe('BR');
    expect(res.body.preferences.display?.compactMode).toBe(true);
    expect(res.body.onboarding.step2CompletedAt).not.toBeNull();
  });

  it('should persist goals on step 3', async () => {
    const { accessToken } = await loginTestUser();
    const headers = await getAuthorizedHeaders(accessToken);

    const res = await request(app)
      .patch('/api/onboarding')
      .set(headers.headers)
      .send({ goals: ['salary', 'spending'], markStepCompleted: 3 });

    expect(res.status).toBe(200);
    expect(res.body.preferences.goals).toEqual(['salary', 'spending']);
    expect(res.body.onboarding.step3CompletedAt).not.toBeNull();
  });

  it('should dismiss onboarding', async () => {
    const { accessToken } = await loginTestUser();
    const headers = await getAuthorizedHeaders(accessToken);

    const res = await request(app).post('/api/onboarding/skip').set(headers.headers);

    expect(res.status).toBe(200);
    expect(res.body.onboarding.status).toBe('DISMISSED');
    expect(res.body.onboarding.needsOnboarding).toBe(false);
  });

  it('should complete onboarding', async () => {
    const { accessToken } = await loginTestUser();
    const headers = await getAuthorizedHeaders(accessToken);
    prefsState = buildPreferences({ step3CompletedAt: null, onboardingStatus: 'IN_PROGRESS' });

    const res = await request(app).post('/api/onboarding/complete').set(headers.headers);

    expect(res.status).toBe(200);
    expect(res.body.onboarding.status).toBe('COMPLETED');
    expect(res.body.onboarding.needsOnboarding).toBe(false);
    expect(res.body.onboarding.completedAt).not.toBeNull();
  });
});

describe('GET /api/auth/me onboarding enrichment', () => {
  it('should signal onboarding when verified and pending', async () => {
    prefsState = buildPreferences({ onboardingStatus: 'NOT_STARTED' });
    const { accessToken } = await loginTestUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.onboarding.needsOnboarding).toBe(true);
  });

  it('should disable onboarding after dismissal', async () => {
    prefsState = buildPreferences({ onboardingStatus: 'DISMISSED', onboardingDismissedAt: new Date() });
    const { accessToken } = await loginTestUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.onboarding.needsOnboarding).toBe(false);
    expect(res.body.user.onboarding.status).toBe('DISMISSED');
  });
});
