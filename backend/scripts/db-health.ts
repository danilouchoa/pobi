import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const ping = await prisma.$runCommandRaw({ ping: 1 });
    console.log('✅ Prisma conectado', ping);
    process.exit(0);
  } catch (error) {
    console.error('❌ Prisma erro', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
