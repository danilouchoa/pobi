// scripts/debug-login.ts
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2] ?? 'danilo.uchoa@finance.app';
  const passwordArg = process.argv[3] ?? 'finance123';

  console.log('=== DEBUG LOGIN FINFY ===');
  console.log('EMAIL       :', emailArg);
  console.log('PASSWORD    :', passwordArg);
  console.log('DATABASE_URL:', process.env.DATABASE_URL);

  // Mesma normalização do loginSchema (toLowerCase)
  const email = emailArg.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log('RESULT      : user NOT FOUND');
    return;
  }

  console.log('USER        :', {
    id: user.id,
    email: user.email,
    provider: (user as any).provider,
    hasPasswordHash: !!user.passwordHash,
  });

  if (!user.passwordHash) {
    console.log('RESULT      : user has NO passwordHash');
    return;
  }

  const isValid = await bcrypt.compare(passwordArg, user.passwordHash);
  console.log('isValidPass :', isValid);
  console.log('RESULT      :', isValid ? 'LOGIN OK (senha confere)' : 'LOGIN FAIL (senha NÃO confere)');
}

main()
  .catch((err) => {
    console.error('ERROR       :', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
