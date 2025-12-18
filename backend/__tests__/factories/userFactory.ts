import { PrismaClient, Provider } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { vi } from 'vitest';

const prisma = new PrismaClient() as any;

type CreateUserOptions = {
  email?: string;
  password?: string;
  passwordHash?: string;
  name?: string | null;
  avatar?: string | null;
  googleId?: string | null;
  id?: string;
};

let users: any[] = [];
let consents: any[] = [];
let verificationTokens: any[] = [];

const clone = <T>(value: T): T => structuredClone(value);

const matchesWhere = (user: any, where: any = {}) => {
  if (!where) return true;
  if (where.id && user.id !== where.id) return false;
  if (where.email && user.email !== where.email) return false;
  if (where.googleId && user.googleId !== where.googleId) return false;

  if (where.userId && user.userId !== undefined && user.userId !== where.userId) return false;

  if (where.createdAt?.gte) {
    if (!user.createdAt || new Date(user.createdAt) < new Date(where.createdAt.gte)) return false;
  }

  if (Array.isArray(where.OR) && where.OR.length) {
    return where.OR.some((clause: any) => matchesWhere(user, clause));
  }

  return true;
};

const ensureUserMocks = () => {
  prisma.user.findUnique = prisma.user.findUnique ?? vi.fn();
  prisma.user.findFirst = prisma.user.findFirst ?? vi.fn();
  prisma.user.create = prisma.user.create ?? vi.fn();
  prisma.user.update = prisma.user.update ?? vi.fn();
  prisma.user.delete = prisma.user.delete ?? vi.fn();

  prisma.userConsent = prisma.userConsent ?? { create: vi.fn(), findMany: vi.fn() };
  prisma.emailVerificationToken = prisma.emailVerificationToken ?? { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() };

  prisma.user.findUnique.mockReset?.();
  prisma.user.findFirst.mockReset?.();
  prisma.user.create.mockReset?.();
  prisma.user.update.mockReset?.();
  prisma.user.delete.mockReset?.();

  prisma.userConsent.create.mockReset?.();
  prisma.userConsent.findMany?.mockReset?.();

  prisma.emailVerificationToken.create.mockReset?.();
  prisma.emailVerificationToken.findFirst.mockReset?.();
  prisma.emailVerificationToken.findUnique.mockReset?.();
  prisma.emailVerificationToken.update.mockReset?.();

  prisma.user.findUnique.mockImplementation(async ({ where }: any = {}) => {
    return clone(users.find((user) => matchesWhere(user, where)) ?? null);
  });

  prisma.user.findFirst.mockImplementation(async ({ where }: any = {}) => {
    return clone(users.find((user) => matchesWhere(user, where)) ?? null);
  });

  prisma.user.create.mockImplementation(async ({ data }: any = {}) => {
    const nextId = data.id ?? `user-${users.length + 1}`;
    const user = { ...data, id: data.id ?? nextId };
    users.push(user);
    return clone(user);
  });

  prisma.userConsent.findMany?.mockImplementation(async ({ where }: any = {}) => {
    return clone(consents.filter((consent) => matchesWhere(consent, where)));
  });

  prisma.userConsent.create.mockImplementation(async ({ data }: any = {}) => {
    const consent = { id: `consent-${consents.length + 1}`, ...data };
    consents.push(consent);
    return clone(consent);
  });

  prisma.emailVerificationToken.findFirst.mockImplementation(async ({ where, orderBy }: any = {}) => {
    let tokens = verificationTokens.filter((token) => matchesWhere(token, where));
    if (orderBy?.createdAt === 'desc') {
      tokens = tokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return clone(tokens[0] ?? null);
  });

  prisma.emailVerificationToken.findUnique.mockImplementation(async ({ where }: any = {}) => {
    return clone(verificationTokens.find((token) => matchesWhere(token, where)) ?? null);
  });

  prisma.emailVerificationToken.create.mockImplementation(async ({ data }: any = {}) => {
    const token = {
      id: data.id ?? `evt-${verificationTokens.length + 1}`,
      createdAt: new Date(),
      consumedAt: null,
      ...data,
    };
    verificationTokens.push(token);
    return clone(token);
  });

  prisma.emailVerificationToken.update.mockImplementation(async ({ where, data }: any = {}) => {
    const token = verificationTokens.find((t) => matchesWhere(t, where));
    if (!token) throw new Error('Token not found');
    Object.assign(token, data);
    return clone(token);
  });

  prisma.user.update.mockImplementation(async ({ where, data }: any = {}) => {
    const user = users.find((u) => matchesWhere(u, where));
    if (!user) {
      throw new Error('User not found');
    }
    Object.assign(user, data);
    return clone(user);
  });

  prisma.user.delete.mockImplementation(async ({ where }: any = {}) => {
    const idx = users.findIndex((u) => matchesWhere(u, where));
    if (idx === -1) {
      throw new Error('User not found');
    }
    const [deleted] = users.splice(idx, 1);
    return clone(deleted);
  });
};

export const resetUserFactory = () => {
  users = [];
  consents = [];
  verificationTokens = [];
  ensureUserMocks();
};

export const createLocalUser = async (overrides: CreateUserOptions = {}) => {
  ensureUserMocks();
  const email = overrides.email ?? `user${users.length + 1}@finance.app`;
  const password = overrides.password ?? 'Password123';
  const passwordHash = overrides.passwordHash !== undefined
    ? overrides.passwordHash
    : await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      id: overrides.id,
      email,
      passwordHash,
      name: overrides.name ?? 'Local User',
      avatar: overrides.avatar ?? null,
      provider: Provider.LOCAL,
      googleId: overrides.googleId ?? null,
    },
  });
};

export const createGoogleUser = async (overrides: CreateUserOptions = {}) => {
  ensureUserMocks();
  const email = overrides.email ?? `google${users.length + 1}@finance.app`;

  return prisma.user.create({
    data: {
      id: overrides.id,
      email,
      passwordHash: overrides.passwordHash ?? null,
      name: overrides.name ?? 'Google User',
      avatar: overrides.avatar ?? null,
      provider: Provider.GOOGLE,
      googleId: overrides.googleId ?? `google-${users.length + 1}`,
    },
  });
};

export const getUsers = () => clone(users);
export const getConsents = () => clone(consents);
export const getVerificationTokens = () => clone(verificationTokens);

export { prisma as userFactoryPrisma };
