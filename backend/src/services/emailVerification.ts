import crypto from 'crypto';
import { PrismaClient, type EmailVerificationToken, type Prisma } from '@prisma/client';
import { config } from '../config';

export const EMAIL_VERIFICATION_QUEUE = 'email-jobs';

export enum EmailVerificationTokenStatus {
  Valid = 'valid',
  Expired = 'expired',
  AlreadyUsed = 'already_used',
  NotFound = 'not_found',
}

const HASH_ALGORITHM = 'sha256';
const TOKEN_BYTE_SIZE = 32;

const prisma = new PrismaClient();

const resolvePrisma = (client?: PrismaClient) => client ?? prisma;

const hashToken = (token: string) => crypto.createHash(HASH_ALGORITHM).update(token, 'utf8').digest('hex');

export const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(TOKEN_BYTE_SIZE).toString('hex');
  return { rawToken, tokenHash: hashToken(rawToken) };
};

export const buildTokenExpiry = (now = new Date()) => {
  const hours = config.emailVerificationTokenTtlHours ?? 24;
  const expires = new Date(now);
  expires.setHours(expires.getHours() + hours);
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
  prisma?: PrismaClient;
}): Promise<{ rawToken: string; expiresAt: Date; tokenId: string }> => {
  const client = resolvePrisma(options.prisma);
  const { rawToken, tokenHash } = generateVerificationToken();
  const expiresAt = buildTokenExpiry();

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
  options: { prisma?: PrismaClient; now?: Date } = {},
): Promise<TokenResolutionResult> => {
  const client = resolvePrisma(options.prisma);
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
  options: { prisma?: PrismaClient; now?: Date } = {},
): Promise<TokenConsumptionResult> => {
  const client = resolvePrisma(options.prisma);
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
  options: { prisma?: PrismaClient; now?: Date } = {},
): Promise<{ allowed: boolean; reason: TokenResendCheckReason; lastTokenCreatedAt?: Date }> => {
  const client = resolvePrisma(options.prisma);
  const windowMinutes = config.emailVerificationResendMinutes ?? 10;
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

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
