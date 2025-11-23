// Seed de usuário de teste para integração
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'danilo.uchoa@finance.app';
  const password = 'finance123';
  const name = 'Danilo Uchôa';
  const passwordHash = await bcrypt.hash(password, 10);

  // Remove usuário se já existir
  await prisma.user.deleteMany({ where: { email } });

  // Cria usuário
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  console.log('Usuário de teste criado:', email);
}

main().finally(() => prisma.$disconnect());
