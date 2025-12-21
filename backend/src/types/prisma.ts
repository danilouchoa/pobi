import type { Prisma } from '@prisma/client';

export type PrismaClientLike = {
  user: {
    findUnique: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
    count: (...args: any[]) => Promise<any>;
  };
  origin: {
    findMany: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
  };
  debtor: {
    findMany: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
  };
  expense: {
    findMany: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
    count: (...args: any[]) => Promise<any>;
  };
  salaryHistory: {
    findMany: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
  };
  job: {
    findMany: (...args: any[]) => Promise<any>;
    findUnique: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
  };
  userConsent: {
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
  emailVerificationToken: {
    findUnique: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
  };
  userPreferences: {
    findUnique: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
  };
  $transaction: <T>(
    callback: (tx: PrismaClientLike | Prisma.TransactionClient) => Promise<T>
  ) => Promise<T>;
};
