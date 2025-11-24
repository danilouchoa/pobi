import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const HASH_ALGO = 'sha256';

export const EMAIL_VERIFICATION_QUEUE = 'email-jobs';

export type EmailVerificationOutcome =
  | { status: 'valid'; tokenId: string; userId: string }
  | { status: 'invalid' }
  | { status: 'expired'; tokenId: string; userId: string }
  | { status: 'already-used'; tokenId: string; userId: string };

const hashToken = (token: string) => crypto.createHash(HASH_ALGO).update(token).digest('hex');

export const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashToken(rawToken) };
};

export const buildTokenExpiry = () => {
  const hours = config.emailVerificationTokenTtlHours ?? 24;
  const expires = new Date();
  expires.setHours(expires.getHours() + hours);
  return expires;
};

export async function createEmailVerificationToken(options: {
  prisma: PrismaClient;
  userId: string;
  createdIp?: string;
}) {
  const { prisma, userId, createdIp } = options;
  const { rawToken, tokenHash } = generateVerificationToken();

  const record = await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: buildTokenExpiry(),
      createdIp,
    },
  });

  return { rawToken, record };
}

export async function resolveToken(prisma: PrismaClient, rawToken: string, now = new Date()): Promise<EmailVerificationOutcome> {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.emailVerificationToken.findFirst({ where: { tokenHash } });

  if (!token) return { status: 'invalid' };
  if (token.consumedAt) return { status: 'already-used', tokenId: token.id, userId: token.userId };
  if (token.expiresAt < now) return { status: 'expired', tokenId: token.id, userId: token.userId };
  return { status: 'valid', tokenId: token.id, userId: token.userId };
}

export async function consumeToken(prisma: PrismaClient, tokenId: string) {
  return prisma.emailVerificationToken.update({
    where: { id: tokenId },
    data: { consumedAt: new Date() },
  });
}

export const verificationResendThrottleMinutes = () => config.emailVerificationResendMinutes ?? 10;

export async function canIssueNewToken(prisma: PrismaClient, userId: string): Promise<boolean> {
  const windowMinutes = verificationResendThrottleMinutes();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  });
  return !recentToken;
}
