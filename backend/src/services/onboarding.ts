import { Prisma } from '@prisma/client';
import { logEvent } from '../lib/logger';
import type { PrismaClientLike } from '../types/prisma';

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';

export type DisplayPreferences = Record<string, unknown> | null | undefined;

export type OnboardingPreferencesDTO = {
  countryCode: string | null;
  currencyCode: string | null;
  timezone: string | null;
  display: DisplayPreferences;
  goals: string[];
};

export type OnboardingProgressDTO = {
  status: OnboardingStatus;
  needsOnboarding: boolean;
  firstPromptedAt: Date | null;
  dismissedAt: Date | null;
  completedAt: Date | null;
  step1CompletedAt: Date | null;
  step2CompletedAt: Date | null;
  step3CompletedAt: Date | null;
};

export type OnboardingDTO = {
  profile: {
    name: string | null;
    avatar: string | null;
  };
  preferences: OnboardingPreferencesDTO;
  onboarding: OnboardingProgressDTO;
};

export type PatchOnboardingDTO = {
  name?: string;
  avatar?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  display?: DisplayPreferences;
  goals?: string[];
  markStepCompleted?: 1 | 2 | 3;
};

type PrismaOrTx = PrismaClientLike | Prisma.TransactionClient;

const resolveStatus = (prefs: { onboardingStatus?: string | null; onboardingCompletedAt?: Date | null; onboardingDismissedAt?: Date | null; }): OnboardingStatus => {
  if (prefs.onboardingCompletedAt || prefs.onboardingStatus === 'COMPLETED') return 'COMPLETED';
  if (prefs.onboardingDismissedAt || prefs.onboardingStatus === 'DISMISSED') return 'DISMISSED';
  if (prefs.onboardingStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'NOT_STARTED';
};

const computeNeedsOnboarding = (prefs: { onboardingStatus?: string | null; onboardingCompletedAt?: Date | null; onboardingDismissedAt?: Date | null; }): boolean => {
  const status = resolveStatus(prefs);
  return status !== 'COMPLETED' && status !== 'DISMISSED';
};

const normalizeDisplay = (value: Prisma.JsonValue | null | undefined): DisplayPreferences => {
  if (value == null) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
};

export const getOrCreateUserPreferences = async (userId: string, prisma: PrismaOrTx) => {
  const existing = await prisma.userPreferences.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.userPreferences.create({ data: { userId } });
};

export const ensureFirstPrompted = async (userId: string, prisma: PrismaClientLike, now = new Date()) => {
  const prefs = await getOrCreateUserPreferences(userId, prisma);
  const status = resolveStatus(prefs);
  if (status === 'COMPLETED' || status === 'DISMISSED' || prefs.onboardingFirstPromptedAt) {
    return prefs;
  }

  const updated = await prisma.userPreferences.update({
    where: { userId },
    data: {
      onboardingFirstPromptedAt: now,
      onboardingStatus: 'IN_PROGRESS',
    },
  });

  logEvent({ event: 'onboarding.prompted', userId, meta: { status: updated.onboardingStatus } });
  return updated;
};

const buildDto = (
  user: { name?: string | null; avatar?: string | null },
  prefs: Awaited<ReturnType<typeof getOrCreateUserPreferences>>,
): OnboardingDTO => {
  const status = resolveStatus(prefs);
  const needsOnboarding = computeNeedsOnboarding(prefs);

  return {
    profile: {
      name: user.name ?? null,
      avatar: user.avatar ?? null,
    },
    preferences: {
      countryCode: prefs.countryCode ?? null,
      currencyCode: prefs.currencyCode ?? null,
      timezone: prefs.timezone ?? null,
      display: normalizeDisplay(prefs.display),
      goals: prefs.goals ?? [],
    },
    onboarding: {
      status,
      needsOnboarding,
      firstPromptedAt: prefs.onboardingFirstPromptedAt ?? null,
      dismissedAt: prefs.onboardingDismissedAt ?? null,
      completedAt: prefs.onboardingCompletedAt ?? null,
      step1CompletedAt: prefs.step1CompletedAt ?? null,
      step2CompletedAt: prefs.step2CompletedAt ?? null,
      step3CompletedAt: prefs.step3CompletedAt ?? null,
    },
  };
};

export const getOnboardingState = async (userId: string, prisma: PrismaClientLike) => {
  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } }),
    getOrCreateUserPreferences(userId, prisma),
  ]);

  return buildDto(user ?? { name: null, avatar: null }, prefs);
};

export const patchOnboarding = async (userId: string, patch: PatchOnboardingDTO, prisma: PrismaClientLike) => {
  return prisma.$transaction(async (tx) => {
    const prefs = await getOrCreateUserPreferences(userId, tx);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });

    const data: Prisma.UserPreferencesUpdateInput = {};
    let mutated = false;

    if (patch.countryCode !== undefined) {
      data.countryCode = patch.countryCode;
      mutated = true;
    }
    if (patch.currencyCode !== undefined) {
      data.currencyCode = patch.currencyCode;
      mutated = true;
    }
    if (patch.timezone !== undefined) {
      data.timezone = patch.timezone;
      mutated = true;
    }
    if (patch.display !== undefined) {
      data.display = patch.display as Prisma.JsonValue;
      mutated = true;
    }
    if (patch.goals !== undefined) {
      data.goals = patch.goals;
      mutated = true;
    }

    let onboardingStatus: OnboardingStatus = resolveStatus(prefs);

    const now = new Date();

    if (patch.markStepCompleted === 1) {
      data.step1CompletedAt = prefs.step1CompletedAt ?? now;
    }
    if (patch.markStepCompleted === 2) {
      data.step2CompletedAt = prefs.step2CompletedAt ?? now;
    }
    if (patch.markStepCompleted === 3) {
      data.step3CompletedAt = prefs.step3CompletedAt ?? now;
    }

    if (patch.markStepCompleted) {
      onboardingStatus = onboardingStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : onboardingStatus;
      data.onboardingStatus = onboardingStatus;
      logEvent({ event: 'onboarding.step.saved', userId, meta: { step: patch.markStepCompleted } });
    }

    if (patch.name !== undefined || patch.avatar !== undefined) {
      mutated = true;
    }

    if (mutated && onboardingStatus === 'NOT_STARTED') {
      onboardingStatus = 'IN_PROGRESS';
      data.onboardingStatus = onboardingStatus;
    }

    const updatedPrefs = await tx.userPreferences.update({ where: { userId }, data });

    const updatedUser =
      patch.name !== undefined || patch.avatar !== undefined
        ? await tx.user.update({
            where: { id: userId },
            data: {
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
            },
            select: { name: true, avatar: true },
          })
        : user ?? { name: null, avatar: null };

    return buildDto(updatedUser, updatedPrefs);
  });
};

export const dismissOnboarding = async (userId: string, prisma: PrismaClientLike) => {
  const now = new Date();
  const prefs = await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      onboardingDismissedAt: now,
      onboardingStatus: 'DISMISSED',
    },
    update: {
      onboardingDismissedAt: now,
      onboardingStatus: 'DISMISSED',
    },
  });
  logEvent({ event: 'onboarding.dismissed', userId, meta: { status: prefs.onboardingStatus } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
  return buildDto(user ?? { name: null, avatar: null }, prefs);
};

export const completeOnboarding = async (userId: string, prisma: PrismaClientLike) => {
  const now = new Date();
  const prefsBefore = await getOrCreateUserPreferences(userId, prisma);
  const prefs = await prisma.userPreferences.update({
    where: { userId },
    data: {
      onboardingCompletedAt: now,
      onboardingStatus: 'COMPLETED',
      step3CompletedAt: prefsBefore.step3CompletedAt ?? now,
    },
  });
  logEvent({ event: 'onboarding.completed', userId, meta: { status: prefs.onboardingStatus } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
  return buildDto(user ?? { name: null, avatar: null }, prefs);
};
