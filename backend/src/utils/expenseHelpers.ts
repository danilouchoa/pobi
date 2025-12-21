import { Prisma, PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { toDecimalString } from './formatters';

export const generateFingerprint = (seed?: string): string => {
  const uuid = crypto.randomUUID();
  if (seed) {
    const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
    return `${hash}-${uuid}`;
  }
  return uuid;
};

export type RecurrenceType = 'monthly' | 'weekly' | 'yearly';

export type ExpensePayload = {
  description?: string;
  category?: string;
  parcela?: string;
  amount?: number | string;
  date?: string | Date;
  originId?: string | null;
  debtorId?: string | null;
  recurring?: boolean;
  recurrenceType?: RecurrenceType | null;
  fixed?: boolean;
  installments?: number | null;
  sharedWith?: string | null;
  sharedAmount?: number | string | null;
  incrementMonth?: boolean;
  customDate?: string;
  fingerprint?: string;
  installmentGroupId?: string | null;
};

const normalizeDecimalSource = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (Decimal.isDecimal(value)) return value.toString();
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    return normalized.length ? normalized : null;
  }
  return null;
};

const createDecimal = (value: unknown, field = 'valor'): Decimal => {
  const source = normalizeDecimalSource(value);
  if (!source) {
    throw new Error(`Valor inválido para ${field}.`);
  }
  const decimal = new Decimal(source);
  if (!decimal.isFinite()) {
    throw new Error(`Valor inválido para ${field}.`);
  }
  return decimal;
};

const createDecimalOrNull = (value: unknown, field = 'valor'): Decimal | null => {
  if (value === null || value === undefined) return null;
  return createDecimal(value, field);
};

export const coerceBool = (value: any, fallback = false) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
};

export const parseDateOrNow = (value?: string | Date) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const addByRecurrence = (date: Date, recurrenceType?: RecurrenceType | null) => {
  const out = new Date(date);
  switch (recurrenceType) {
    case 'weekly':
      out.setDate(out.getDate() + 7);
      break;
    case 'yearly':
      out.setFullYear(out.getFullYear() + 1);
      break;
    default:
      out.setMonth(out.getMonth() + 1);
  }
  return out;
};

const validateRequiredFields = (body: ExpensePayload) => {
  if (!body.description || !body.category) {
    throw new Error('Campos obrigatórios ausentes.');
  }
};

export const validateFlags = (recurring?: boolean, fixed?: boolean) => {
  if (recurring && fixed) {
    throw new Error('Uma despesa não pode ser recorrente e fixa ao mesmo tempo.');
  }
};

export const buildCreateData = (userId: string, body: ExpensePayload) => {
  validateRequiredFields(body);
  const amountDecimal = createDecimal(body.amount, 'amount');
  if (amountDecimal.lte(0)) {
    throw new Error('Valor inválido.');
  }

  const recurring = coerceBool(body.recurring);
  const fixed = coerceBool(body.fixed);
  validateFlags(recurring, fixed);

  const sharedAmountDecimal = createDecimalOrNull(body.sharedAmount, 'sharedAmount');
  if (sharedAmountDecimal && sharedAmountDecimal.gt(amountDecimal)) {
    throw new Error('sharedAmount > amount');
  }

  const fingerprint =
    body.fingerprint ??
    generateFingerprint(`${userId}-${body.description}-${body.date ?? ''}`);

  let normalizedParcela = body.parcela ?? 'Único';
  // Regex segura: usa limite de caracteres para evitar ReDoS
  // Aceita formatos: "1/12", "Desc 1/12", "1/12 Desc", etc.
  const parcelaMatch =
    typeof normalizedParcela === 'string'
      ? normalizedParcela.match(/^(.{0,100}?)(\d{1,4})\s*\/\s*(\d{1,4})(.{0,100}?)$/)
      : null;
  const inferredInstallments = (() => {
    if (!parcelaMatch) return null;
    const total = Number(parcelaMatch[3]);
    return Number.isFinite(total) && total > 1 ? total : null;
  })();

  return {
    userId,
    description: body.description!,
    category: body.category!,
    parcela: normalizedParcela,
    amount: toDecimalString(amountDecimal.toString()),
    date: parseDateOrNow(body.date),
    originId: body.originId ?? null,
    debtorId: body.debtorId ?? null,
    recurring,
    recurrenceType: recurring ? body.recurrenceType ?? 'monthly' : null,
    fixed,
    installments: body.installments ?? inferredInstallments,
    sharedWith: body.sharedWith ?? null,
    sharedAmount: sharedAmountDecimal
      ? toDecimalString(sharedAmountDecimal.toString())
      : null,
    fingerprint,
    installmentGroupId: body.installmentGroupId ?? null,
  };
};

export const buildUpdateData = (body: ExpensePayload) => {
  const payload: Record<string, unknown> = {};
  if (body.description !== undefined) payload.description = body.description;
  if (body.category !== undefined) payload.category = body.category;
  if (body.parcela !== undefined) payload.parcela = body.parcela;
  if (body.amount !== undefined) payload.amount = toDecimalString(body.amount);
  if (body.date !== undefined) payload.date = parseDateOrNow(body.date);
  if (body.originId !== undefined) payload.originId = body.originId;
  if (body.debtorId !== undefined) payload.debtorId = body.debtorId;
  if (body.recurring !== undefined) payload.recurring = coerceBool(body.recurring);
  if (body.recurrenceType !== undefined) payload.recurrenceType = body.recurrenceType;
  if (body.fixed !== undefined) payload.fixed = coerceBool(body.fixed);
  if (body.installments !== undefined) payload.installments = body.installments;
  if (body.sharedWith !== undefined) payload.sharedWith = body.sharedWith;
  if (body.sharedAmount !== undefined) {
    payload.sharedAmount =
      body.sharedAmount === null ? null : toDecimalString(body.sharedAmount);
  }
  return payload;
};

export const ensureOwnership = async (
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string,
  userId: string
) => {
  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  return existing ?? null;
};
