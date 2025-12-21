/**
 * tenant-backfill-demo-user.ts
 *
 * Backfill controlado para atribuir userId em documentos órfãos.
 *
 * Estratégia:
 * - DEV/TEST: permite backfill para o DEMO user (demo@finfy.app) quando flag ativada.
 * - PROD: bloqueia por padrão (exige flag explícita de override).
 *
 * Uso:
 * TENANT_BACKFILL_DEMO_USER=true NODE_ENV=development npx tsx backend/scripts/tenant-backfill-demo-user.ts
 */

import 'dotenv/config';
import { PrismaClient, Provider } from '@prisma/client';
import { ObjectId } from 'bson';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@finfy.app';
const BACKFILL_FLAG = process.env.TENANT_BACKFILL_DEMO_USER === 'true';
const ALLOW_PROD_FLAG = process.env.TENANT_BACKFILL_ALLOW_PROD === 'true';
const DRY_RUN_FLAG = process.env.TENANT_BACKFILL_DRY_RUN === 'true';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const guardExecution = () => {
  if (!BACKFILL_FLAG) {
    console.error(
      '[tenant-backfill] Bloqueado: defina TENANT_BACKFILL_DEMO_USER=true para executar.'
    );
    process.exit(1);
  }
  if (NODE_ENV === 'production' && !ALLOW_PROD_FLAG) {
    console.error(
      '[tenant-backfill] Bloqueado em produção. Use TENANT_BACKFILL_ALLOW_PROD=true para override.'
    );
    process.exit(1);
  }
};

const collections = [
  { name: 'Origin', label: 'origins' },
  { name: 'Debtor', label: 'debtors' },
  { name: 'Expense', label: 'expenses' },
  { name: 'SalaryHistory', label: 'salaryHistory' },
  { name: 'Job', label: 'jobs' },
  { name: 'UserConsent', label: 'userConsents' },
  { name: 'EmailVerificationToken', label: 'emailVerificationTokens' },
  { name: 'UserPreferences', label: 'userPreferences' },
];

const backfillCollection = async (
  collection: string,
  demoUserId: ObjectId,
  dryRun: boolean
) => {
  if (dryRun) {
    const result = await prisma.$runCommandRaw({
      count: collection,
      query: { $or: [{ userId: { $exists: false } }, { userId: null }] },
    });
    return result as { n?: number };
  }

  const result = await prisma.$runCommandRaw({
    update: collection,
    updates: [
      {
        q: { $or: [{ userId: { $exists: false } }, { userId: null }] },
        u: { $set: { userId: demoUserId } },
        multi: true,
      },
    ],
  });
  return result as { nModified?: number; n?: number };
};

async function main() {
  guardExecution();

  console.log(
    `[tenant-backfill] Iniciando backfill para DEMO user${DRY_RUN_FLAG ? ' (DRY RUN)' : ''}.`
  );

  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      provider: Provider.LOCAL,
      passwordHash: null,
    },
  });

  const demoUserId = new ObjectId(demoUser.id);
  let totalModified = 0;

  for (const { name, label } of collections) {
    const result = await backfillCollection(name, demoUserId, DRY_RUN_FLAG);
    const modified = DRY_RUN_FLAG ? result.n ?? 0 : result.nModified ?? 0;
    totalModified += modified;
    console.log(
      `[tenant-backfill] ${label}: ${modified} documento(s) ${
        DRY_RUN_FLAG ? 'pendente(s)' : 'atualizado(s)'
      }.`
    );
  }

  console.log(
    `[tenant-backfill] Concluído. Total ${DRY_RUN_FLAG ? 'pendente' : 'atualizado'}: ${totalModified}.`
  );
}

main()
  .catch((error) => {
    console.error('[tenant-backfill] Erro ao executar backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
