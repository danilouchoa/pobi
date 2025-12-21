import crypto from 'crypto';
import { type EmailVerificationToken, type Prisma } from '@prisma/client';
import { config } from '../config';
import { EMAIL_VERIFICATION_QUEUE } from '../lib/queues';
export { EMAIL_VERIFICATION_QUEUE };
import type { PrismaClientLike } from '../types/prisma';

export enum EmailVerificationTokenStatus {
  Valid = 'valid',
  Expired = 'expired',
  AlreadyUsed = 'already_used',
  NotFound = 'not_found',
}

const HASH_ALGORITHM = 'sha256';
const TOKEN_BYTE_SIZE = 32;

const hashToken = (token: string) => crypto.createHash(HASH_ALGORITHM).update(token, 'utf8').digest('hex');

export const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(TOKEN_BYTE_SIZE).toString('hex');
  return { rawToken, tokenHash: hashToken(rawToken) };
};

export const buildTokenExpiry = (now = new Date()) => {
  const minutes = config.emailVerificationTokenTtlMinutes ?? 24 * 60;
  const expires = new Date(now);
  expires.setMinutes(expires.getMinutes() + minutes);
  return expires;
};

export type EmailVerificationTokenRecord = Pick<
  EmailVerificationToken,
  'id' | 'userId' | 'expiresAt' | 'consumedAt' | 'createdAt' | 'createdIp'
>;

export type TokenResolutionResult =
  | { status: EmailVerificationTokenStatus.NotFound }
  | { status: EmailVerificationTokenStatus.Valid; token: EmailVerificationTokenRecord }
  | { status: EmailVerificationTokenStatus.Expired; token: EmailVerificationTokenRecord }
  | { status: EmailVerificationTokenStatus.AlreadyUsed; token: EmailVerificationTokenRecord };

export type TokenConsumptionResult =
  | { status: EmailVerificationTokenStatus.NotFound }
  | { status: EmailVerificationTokenStatus.Expired; token: EmailVerificationTokenRecord }
  | { status: EmailVerificationTokenStatus.AlreadyUsed; token: EmailVerificationTokenRecord }
  | {
      status: EmailVerificationTokenStatus.Valid;
      token: EmailVerificationTokenRecord;
      user: { id: string; emailVerifiedAt: Date | null; emailVerifiedIp: string | null };
    };

export const createEmailVerificationToken = async (options: {
  userId: string;
  createdIp?: string | null;
  prisma: PrismaClientLike;
  now?: Date;
}): Promise<{ rawToken: string; expiresAt: Date; tokenId: string }> => {
  const client = options.prisma;
  const { rawToken, tokenHash } = generateVerificationToken();
  const expiresAt = buildTokenExpiry(options.now);

  const record = await client.emailVerificationToken.create({
    data: {
      userId: options.userId,
      tokenHash,
      expiresAt,
      createdIp: options.createdIp ?? undefined,
      consumedAt: null,
    },
  });

  return { rawToken, expiresAt: record.expiresAt, tokenId: record.id };
};

export const resolveToken = async (
  rawToken: string,
  options: { prisma: PrismaClientLike; now?: Date },
): Promise<TokenResolutionResult> => {
  const client = options.prisma;
  const tokenHash = hashToken(rawToken);
  const token = await client.emailVerificationToken.findFirst({ where: { tokenHash } });
  const now = options.now ?? new Date();

  if (!token) return { status: EmailVerificationTokenStatus.NotFound };
  if (token.consumedAt) return { status: EmailVerificationTokenStatus.AlreadyUsed, token };
  if (token.expiresAt <= now) return { status: EmailVerificationTokenStatus.Expired, token };
  return { status: EmailVerificationTokenStatus.Valid, token };
};

export const consumeToken = async (
  rawToken: string,
  verificationIp: string | null,
  options: { prisma: PrismaClientLike; now?: Date },
): Promise<TokenConsumptionResult> => {
  const client = options.prisma;
  const now = options.now ?? new Date();
  const resolution = await resolveToken(rawToken, { prisma: client, now });

  if (resolution.status !== EmailVerificationTokenStatus.Valid) {
    return resolution;
  }

  const { token } = resolution;

  const result = await client.$transaction(async (tx: Prisma.TransactionClient) => {
    const consumedToken = await tx.emailVerificationToken.update({
      where: { id: token.id },
      data: { consumedAt: now },
    });

    const existingUser = await tx.user.findUnique({ where: { id: token.userId } });
    if (!existingUser) {
      return null;
    }

    const updatedUser = await tx.user.update({
      where: { id: token.userId },
      data: {
        emailVerifiedAt: existingUser.emailVerifiedAt ?? now,
        emailVerifiedIp: verificationIp ?? existingUser.emailVerifiedIp ?? null,
      },
    });

    return { consumedToken, updatedUser };
  });

  if (!result) {
    return { status: EmailVerificationTokenStatus.NotFound };
  }

  return {
    status: EmailVerificationTokenStatus.Valid,
    token: result.consumedToken,
    user: {
      id: result.updatedUser.id,
      emailVerifiedAt: result.updatedUser.emailVerifiedAt,
      emailVerifiedIp: result.updatedUser.emailVerifiedIp ?? null,
    },
  };
};

export type TokenResendCheckReason = 'within_resend_window' | 'no_recent_token' | 'outside_resend_window';

export const canIssueNewToken = async (
  userId: string,
  options: { prisma: PrismaClientLike; now?: Date },
): Promise<{ allowed: boolean; reason: TokenResendCheckReason; lastTokenCreatedAt?: Date }> => {
  const client = options.prisma;
  const windowSeconds = config.emailVerificationResendWindowSeconds ?? 10 * 60;
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  const recentToken = await client.emailVerificationToken.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!recentToken) {
    return { allowed: true, reason: 'no_recent_token' };
  }

  const allowed = recentToken.createdAt < windowStart;

  return {
    allowed,
    reason: allowed ? 'outside_resend_window' : 'within_resend_window',
    lastTokenCreatedAt: recentToken.createdAt,
  };
};
