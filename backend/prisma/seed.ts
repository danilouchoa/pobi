import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient, Provider } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const ENABLE_DEV_SEED = process.env.ENABLE_DEV_SEED === 'true';
const SEED_DEMO = process.env.SEED_DEMO === 'true';
const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'finance123';
const email = 'demo@finfy.app';

async function main() {
  /**
   * Seed de demo: seguro apenas para dev/test.
   * - Nunca roda em produção sem SEED_DEMO=true.
   * - Todos os dados devem pertencer ao usuário demo (demo@finfy.app).
   */
  if (!ENABLE_DEV_SEED) {
    console.log('⚠️ Seed abortado: defina ENABLE_DEV_SEED=true para executar este seed de desenvolvimento.');
    process.exit(0);
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (!['development', 'test'].includes(nodeEnv) && !SEED_DEMO) {
    console.log('⚠️ Seed abortado: permitido apenas em development/test ou com SEED_DEMO=true.');
    process.exit(0);
  }

  if (nodeEnv === 'production' && !SEED_DEMO) {
    console.error('❌ Seed bloqueado em produção.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Demo User',
      passwordHash,
      provider: Provider.LOCAL,
    },
    create: {
      email,
      name: 'Demo User',
      passwordHash,
      provider: Provider.LOCAL,
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
