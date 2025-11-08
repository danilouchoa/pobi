import { addDays, isSaturday, isSunday } from "date-fns";

export type BillingRolloverPolicy = "NEXT_BUSINESS_DAY" | "PREVIOUS_BUSINESS_DAY";

export function adjustToBusinessDay(
  date: Date,
  policy: BillingRolloverPolicy = "NEXT_BUSINESS_DAY"
): Date {
  if (isSaturday(date)) {
    return policy === "NEXT_BUSINESS_DAY" ? addDays(date, 2) : addDays(date, -1);
  }
  if (isSunday(date)) {
    return policy === "NEXT_BUSINESS_DAY" ? addDays(date, 1) : addDays(date, -2);
  }
  return date;
}

export function getEffectiveClosingDate(
  year: number,
  month: number,
  closingDay: number,
  policy: BillingRolloverPolicy
): Date {
  const base = new Date(Date.UTC(year, month - 1, closingDay, 23, 59, 59, 999));
  return adjustToBusinessDay(base, policy);
}

const formatYearMonth = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

export function deriveBillingMonth(
  txDate: Date,
  closingDay: number,
  policy: BillingRolloverPolicy
): string {
  const year = txDate.getUTCFullYear();
  const month = txDate.getUTCMonth() + 1; // 1..12
  const closingDate = getEffectiveClosingDate(year, month, closingDay, policy);

  if (txDate.getTime() > closingDate.getTime()) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return formatYearMonth(nextYear, nextMonth);
  }

  return formatYearMonth(year, month);
}
