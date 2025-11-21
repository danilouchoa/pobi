import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const ENABLE_DEV_SEED = process.env.ENABLE_DEV_SEED === 'true';
const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'finance123';
const email = 'danilo.uchoa@finance.app';

async function main() {
  if (!ENABLE_DEV_SEED) {
    console.log('⚠️ Seed abortado: defina ENABLE_DEV_SEED=true para executar este seed de desenvolvimento.');
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Danilo Uchoa',
      passwordHash,
    },
    create: {
      email,
      name: 'Danilo Uchoa',
      passwordHash,
    },
  });

  console.log('✅ Usuário padrão criado/atualizado:', {
    id: user.id,
    email: user.email,
  });
  console.log(`Senha utilizada: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Erro ao executar seed Prisma:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
