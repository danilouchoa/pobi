import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/pt-br";

dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);
dayjs.locale("pt-br");

const MONTH_FORMAT = "YYYY-MM";

const coerceMonth = (value?: string): Dayjs => {
  if (value && dayjs(value, MONTH_FORMAT, true).isValid()) {
    return dayjs(value, MONTH_FORMAT, true);
  }
  return dayjs().startOf("month");
};

export const formatMonthLabel = (value: string): string =>
  coerceMonth(value).format("MMM/YYYY").toLowerCase();

export const getPreviousMonth = (value: string): string =>
  coerceMonth(value).subtract(1, "month").format(MONTH_FORMAT);

export const getNextMonth = (value: string): string =>
  coerceMonth(value).add(1, "month").format(MONTH_FORMAT);

export const compareMonths = (a: string, b: string): number =>
  coerceMonth(a).diff(coerceMonth(b), "month");

export const normalizeMonth = (value: string): string =>
  coerceMonth(value).format(MONTH_FORMAT);
