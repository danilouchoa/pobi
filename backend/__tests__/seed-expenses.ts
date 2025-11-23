import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateFingerprint(userId: string, date: Date, description: string, amount: string): string {
  const dateStr = date.toISOString().split('T')[0];
  const raw = `${userId}:${dateStr}:${description}:${amount}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

async function main() {
  // 1. Criar usuário
  const passwordHash = await bcrypt.hash('finance123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'danilo.uchoa@finance.app' },
    update: { passwordHash },
    create: {
      email: 'danilo.uchoa@finance.app',
      name: 'Danilo Uchoa',
      passwordHash,
    },
  });

  console.log('✅ Usuário criado:', user.email);

  // 2. Criar Origins (Cartões) - buscar ou criar
  let c6 = await prisma.origin.findFirst({ where: { name: 'Cartão C6', userId: user.id } });
  if (!c6) {
    c6 = await prisma.origin.create({
      data: {
        name: 'Cartão C6',
        type: 'Cartão',
        userId: user.id,
        closingDay: 20,
        billingRolloverPolicy: 'NEXT',
      },
    });
  }

  let nubank = await prisma.origin.findFirst({ where: { name: 'Cartão Nubank', userId: user.id } });
  if (!nubank) {
    nubank = await prisma.origin.create({
      data: {
        name: 'Cartão Nubank',
        type: 'Cartão',
        userId: user.id,
        closingDay: 4,
        billingRolloverPolicy: 'NEXT',
      },
    });
  }

  let mercadoPago = await prisma.origin.findFirst({ where: { name: 'Cartão Mercado Pago', userId: user.id } });
  if (!mercadoPago) {
    mercadoPago = await prisma.origin.create({
      data: {
        name: 'Cartão Mercado Pago',
        type: 'Cartão',
        userId: user.id,
        closingDay: 11,
        billingRolloverPolicy: 'NEXT',
      },
    });
  }

  let pernambucanas = await prisma.origin.findFirst({ where: { name: 'Cartão Pernambucanas', userId: user.id } });
  if (!pernambucanas) {
    pernambucanas = await prisma.origin.create({
      data: {
        name: 'Cartão Pernambucanas',
        type: 'Cartão',
        userId: user.id,
        closingDay: 11,
        billingRolloverPolicy: 'NEXT',
      },
    });
  }

  let havan = await prisma.origin.findFirst({ where: { name: 'Cartão Havan', userId: user.id } });
  if (!havan) {
    havan = await prisma.origin.create({
      data: {
        name: 'Cartão Havan',
        type: 'Cartão',
        userId: user.id,
        closingDay: 11,
        billingRolloverPolicy: 'NEXT',
      },
    });
  }

  let maravilhas = await prisma.origin.findFirst({ where: { name: 'Cartão Maravilhas do Lar', userId: user.id } });
  if (!maravilhas) {
    maravilhas = await prisma.origin.create({
      data: {
        name: 'Cartão Maravilhas do Lar',
        type: 'Cartão',
        userId: user.id,
        closingDay: 11,
        billingRolloverPolicy: 'NEXT',
      },
    });
  }

  let contasFixas = await prisma.origin.findFirst({ where: { name: 'Contas Fixas', userId: user.id } });
  if (!contasFixas) {
    contasFixas = await prisma.origin.create({
      data: {
        name: 'Contas Fixas',
        type: 'Conta',
        userId: user.id,
      },
    });
  }

  console.log('✅ Origins criadas');

  // 3. Limpar expenses antigas
  await prisma.expense.deleteMany({ where: { userId: user.id } });

  // 4. Criar despesas - Cartão C6 (Vencimento dia 20)
  const c6Expenses = [
    { description: 'itau click', amount: '501.00', parcela: '8 de 10', category: 'Empréstimos' },
    { description: 'shop impressos', amount: '45.98', parcela: '4 de 10', category: 'Impressos' },
    { description: 'playstation', amount: '107.00', parcela: null, category: 'Lazer' },
    { description: 'amazon', amount: '81.90', parcela: '3 de 12', category: 'Compras' },
    { description: 'uber', amount: '111.00', parcela: '2 de 4', category: 'Transporte' },
    { description: 'sorvete', amount: '180.00', parcela: '2 e 2', category: 'Alimentação' },
    { description: 'arte da luta vanessa', amount: '165.00', parcela: null, category: 'Educação' },
    { description: 'mercado', amount: '71.00', parcela: null, category: 'Alimentação' },
    { description: 'pizza', amount: '139.80', parcela: null, category: 'Alimentação' },
    { description: 'ifood', amount: '121.00', parcela: null, category: 'Alimentação' },
    { description: 'amoco sppra', amount: '85.00', parcela: null, category: 'Combustível' },
    { description: 'açai', amount: '10.32', parcela: null, category: 'Alimentação' },
    { description: 'hab sei', amount: '1800.00', parcela: null, category: 'Saúde' },
    { description: 'americanas', amount: '35.00', parcela: '2 de 2', category: 'Compras' },
    { description: 'ifood', amount: '111.00', parcela: null, category: 'Alimentação' },
    { description: 'marmita', amount: '40.00', parcela: null, category: 'Alimentação' },
    { description: 'notebook mac', amount: '245.00', parcela: '1 de 12', category: 'Eletrônicos' },
    { description: 'cisco n.me', amount: '103.69', parcela: '1 de 12', category: 'Internet' },
    { description: 'cafeteria', amount: '287.00', parcela: '1 de 12', category: 'Alimentação' },
    { description: 'outlet vanessa', amount: '110.00', parcela: '1 de 8', category: 'Vestuário' },
    { description: 'arte da luta vanessa', amount: '165.00', parcela: null, category: 'Educação' },
  ];

  for (let i = 0; i < c6Expenses.length; i++) {
    const exp = c6Expenses[i];
    const date = new Date('2025-11-09');
    const fingerprint = generateFingerprint(user.id, date, exp.description + i, exp.amount);
    await prisma.expense.create({
      data: {
        userId: user.id,
        originId: c6.id,
        description: exp.description,
        amount: exp.amount,
        date,
        category: exp.category,
        parcela: exp.parcela || 'Único',
        billingMonth: '2025-11',
        fingerprint,
      },
    });
  }

  // 5. Criar despesas - Cartão Nubank (Vencimento dia 04)
  const nubankExpenses = [
    { description: 'clube unificado', amount: '186.00', category: 'Academia' },
    { description: 'DAS Simples', amount: '1194.31', category: 'Impostos e encargos' },
    { description: 'Contador Mensalidade', amount: '169.00', category: 'Serviços' },
    { description: 'seguro de vida nubank', amount: '52.00', category: 'Seguros' },
    { description: 'amazon', amount: '22.00', category: 'Compras' },
    { description: 'intelbras cloud camera', amount: '16.00', category: 'Tecnologia' },
    { description: 'Microsoft Familty', amount: '60.00', category: 'Assinaturas' },
    { description: 'amazon', amount: '65.00', category: 'Compras' },
    { description: 'Google Drive', amount: '35.99', category: 'Assinaturas' },
    { description: 'cdb', amount: '60.00', category: 'Investimentos' },
    { description: 'chatoppt', amount: '100.00', category: 'IA' },
    { description: 'Cabelo', amount: '140.00', category: 'Beleza' },
    { description: 'redbay', amount: '15.30', parcela: '9 de 12', category: 'Compras' },
    { description: 'exame de sangue', amount: '96.00', parcela: '8 de 10', category: 'Saúde' },
    { description: 'livo', amount: '30.00', parcela: '1 de 6', category: 'Livros' },
    { description: 'msc', amount: '19.00', parcela: '10 de 12', category: 'Serviços' },
    { description: 'van devan', amount: '187.62', parcela: '4 de 10', category: 'Transporte' },
    { description: 'pets dom pedro', amount: '172.00', parcela: '3 de 4', category: 'Pets' },
    { description: 'relogio', amount: '172.00', parcela: '3 de 4', category: 'Acessórios' },
    { description: 'sprint', amount: '37.00', parcela: '3 de 6', category: 'Academia' },
    { description: 'ubatuba', amount: '82.00', parcela: '3 de 12', category: 'Viagem' },
    { description: 'livo', amount: '52.00', parcela: '2 de 6', category: 'Livros' },
    { description: 'tavgem', amount: '50.00', category: 'Viagem' },
    { description: 'posto vita flora', amount: '517.00', category: 'Combustível' },
    { description: 'mercado', amount: '16.20', category: 'Alimentação' },
    { description: 'uber', amount: '27.00', category: 'Transporte' },
    { description: 'padaria', amount: '140.00', category: 'Alimentação' },
    { description: 'oristo', amount: '83.50', category: 'Alimentação' },
    { description: 'supermercado', amount: '125.00', category: 'Alimentação' },
    { description: 'outback', amount: '263.00', category: 'Alimentação' },
    { description: 'bebida', amount: '600.00', category: 'Alimentação' },
    { description: 'farmacia', amount: '29.97', category: 'Saúde' },
    { description: 'gaselink', amount: '47.00', parcela: '1 de 6', category: 'Combustível' },
    { description: 'supermercado', amount: '400.00', category: 'Alimentação' },
    { description: 'abacado', amount: '202.00', category: 'Alimentação' },
    { description: 'danelo davi', amount: '100.00', parcela: '1 de 2', category: 'Pessoal' },
    { description: 'mcdonalds', amount: '120.00', category: 'Alimentação' },
    { description: 'pastel', amount: '33.00', category: 'Alimentação' },
    { description: 'lipo', amount: '23.00', category: 'Saúde' },
    { description: 'qhinelo', amount: '75.00', category: 'Vestuário' },
    { description: 'gella', amount: '550.00', category: 'Beleza' },
    { description: 'larro', amount: '176.00', category: 'Transporte' },
    { description: 'remedios van', amount: '224.00', parcela: '1 de 2', category: 'Saúde' },
    { description: 'shophorto', amount: '110.00', category: 'Compras' },
    { description: 'sorvete', amount: '14.28', category: 'Alimentação' },
    { description: 'mcdonalds', amount: '74.00', category: 'Alimentação' },
    { description: 'restuarante', amount: '309.00', category: 'Alimentação' },
    { description: 'marmita', amount: '45.00', category: 'Alimentação' },
    { description: 'carrinho fi van', amount: '140.00', category: 'Brinquedos' },
  ];

  for (let i = 0; i < nubankExpenses.length; i++) {
    const exp = nubankExpenses[i];
    const date = new Date('2025-11-09');
    const fingerprint = generateFingerprint(user.id, date, exp.description + i, exp.amount);
    await prisma.expense.create({
      data: {
        userId: user.id,
        originId: nubank.id,
        description: exp.description,
        amount: exp.amount,
        date,
        category: exp.category,
        parcela: exp.parcela || 'Único',
        billingMonth: '2025-11',
        fingerprint,
      },
    });
  }

  // 6. Criar despesas - Cartão Mercado Pago
  const mercadoPagoExpenses = [
    { description: 'Cone', amount: '37.75', parcela: '5 de 10', category: 'Alimentação' },
    { description: 'CADEIRA', amount: '40.50', parcela: '3 de 19', category: 'Casa' },
  ];

  for (let i = 0; i < mercadoPagoExpenses.length; i++) {
    const exp = mercadoPagoExpenses[i];
    const date = new Date('2025-11-09');
    const fingerprint = generateFingerprint(user.id, date, exp.description + i, exp.amount);
    await prisma.expense.create({
      data: {
        userId: user.id,
        originId: mercadoPago.id,
        description: exp.description,
        amount: exp.amount,
        date,
        category: exp.category,
        parcela: exp.parcela || 'Único',
        billingMonth: '2025-11',
        fingerprint,
      },
    });
  }

  // 7. Criar despesas - Cartão Havan
  const havanExpenses = [
    { description: 'filtro e panela', amount: '95.00', parcela: '5 de 10', category: 'Casa' },
    { description: 'relogio', amount: '70.00', parcela: '5 de 5', category: 'Acessórios' },
    { description: 'colchao', amount: '32.19', parcela: '2 de 5', category: 'Casa' },
    { description: 'mop', amount: '16.90', parcela: null, category: 'Casa' },
  ];

  for (let i = 0; i < havanExpenses.length; i++) {
    const exp = havanExpenses[i];
    const date = new Date('2025-11-09');
    const fingerprint = generateFingerprint(user.id, date, exp.description + i, exp.amount);
    await prisma.expense.create({
      data: {
        userId: user.id,
        originId: havan.id,
        description: exp.description,
        amount: exp.amount,
        date,
        category: exp.category,
        parcela: exp.parcela || 'Único',
        billingMonth: '2025-11',
        fingerprint,
      },
    });
  }

  // 8. Criar despesas - Cartão Maravilhas do Lar
  const maravilhasExpenses = [
    { description: 'Decoracao', amount: '54.21', parcela: '4 de 6', category: 'Casa' },
  ];

  for (let i = 0; i < maravilhasExpenses.length; i++) {
    const exp = maravilhasExpenses[i];
    const date = new Date('2025-11-09');
    const fingerprint = generateFingerprint(user.id, date, exp.description + i, exp.amount);
    await prisma.expense.create({
      data: {
        userId: user.id,
        originId: maravilhas.id,
        description: exp.description,
        amount: exp.amount,
        date,
        category: exp.category,
        parcela: exp.parcela || 'Único',
        billingMonth: '2025-11',
        fingerprint,
      },
    });
  }

  // 9. Criar Contas Fixas
  const contasFixasExpenses = [
    { description: 'Aluguel', amount: '2500.00', category: 'Moradia' },
    { description: 'Conta de Luz', amount: '200.00', category: 'Utilidades' },
    { description: 'VNO', amount: '190.00', category: 'Internet' },
    { description: 'CIRS', amount: '360.00', category: 'Seguros' },
    { description: 'deposito emprestimo USDT (emprestimo sheila)', amount: '500.00', parcela: '4 de 6', category: 'Empréstimos' },
    { description: 'Seguro', amount: '600.00', parcela: '4 de 6', category: 'Seguros' },
    { description: 'lio', amount: '3200.00', category: 'Pessoal' },
    { description: 'sonhos vanessa', amount: '110.00', parcela: '7 de 10', category: 'Pessoal' },
  ];

  for (let i = 0; i < contasFixasExpenses.length; i++) {
    const exp = contasFixasExpenses[i];
    const date = new Date('2025-11-09');
    const fingerprint = generateFingerprint(user.id, date, exp.description + i, exp.amount);
    await prisma.expense.create({
      data: {
        userId: user.id,
        originId: contasFixas.id,
        description: exp.description,
        amount: exp.amount,
        date,
        category: exp.category,
        parcela: exp.parcela || 'Único',
        billingMonth: '2025-11',
        fingerprint,
      },
    });
  }

  console.log('✅ Despesas criadas com sucesso!');

  // 10. Criar histórico de salário
  await prisma.salaryHistory.upsert({
    where: {
      userId_month: {
        userId: user.id,
        month: '2025-11',
      },
    },
    update: { 
      hours: 160,
      hourRate: 99.60,
      taxRate: 0,
    },
    create: {
      userId: user.id,
      month: '2025-11',
      hours: 160,
      hourRate: 99.60,
      taxRate: 0,
    },
  });

  console.log('✅ Salário criado');

  const totalExpenses = await prisma.expense.count({ where: { userId: user.id } });
  console.log(`\n📊 Total de despesas criadas: ${totalExpenses}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
