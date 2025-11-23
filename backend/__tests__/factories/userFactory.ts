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

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const matchesWhere = (user: any, where: any = {}) => {
  if (!where) return true;
  if (where.id && user.id !== where.id) return false;
  if (where.email && user.email !== where.email) return false;
  if (where.googleId && user.googleId !== where.googleId) return false;

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

  prisma.user.findUnique.mockReset?.();
  prisma.user.findFirst.mockReset?.();
  prisma.user.create.mockReset?.();
  prisma.user.update.mockReset?.();
  prisma.user.delete.mockReset?.();

  prisma.user.findUnique.mockImplementation(async ({ where }: any = {}) => {
    return clone(users.find((user) => matchesWhere(user, where)) ?? null);
  });

  prisma.user.findFirst.mockImplementation(async ({ where }: any = {}) => {
    return clone(users.find((user) => matchesWhere(user, where)) ?? null);
  });

  prisma.user.create.mockImplementation(async ({ data }: any = {}) => {
    const nextId = data.id ?? `user-${users.length + 1}`;
    const user = { id: nextId, ...data };
    users.push(user);
    return clone(user);
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

export { prisma as userFactoryPrisma };
