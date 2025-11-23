import Decimal from 'decimal.js';

export const parseDecimal = (value?: string | number | null): number => {
  if (value === null || value === undefined) return 0;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal.toNumber() : 0;
  } catch {
    return 0;
  }
};

export const toDecimalString = (
  value?: string | number | Decimal | null,
  fractionDigits = 2
): string => {
  if (value === null || value === undefined) {
    return Number(0).toFixed(fractionDigits);
  }
  try {
    const decimal = new Decimal(value as Decimal | number | string);
    return decimal.isFinite() ? decimal.toFixed(fractionDigits) : Number(0).toFixed(fractionDigits);
  } catch {
    return Number(0).toFixed(fractionDigits);
  }
};

export const toDecimalStringOrNull = (
  value?: string | number | Decimal | null,
  fractionDigits = 2
): string | null => {
  if (value === null || value === undefined) return null;
  return toDecimalString(value, fractionDigits);
};
