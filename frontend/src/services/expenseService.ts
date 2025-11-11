import api from "./api";
import { Expense, ExpensePayload, ExpensesResponse, BulkUpdatePayload, BulkUnifiedActionPayload } from "../types";
import { ExpenseSchema, ExpensesResponseSchema, ExpensesSchema } from "../lib/schemas";

//
// Normalização de payload para compatibilidade com o backend
// - Backend espera amount/sharedAmount como string no formato "0.00"
// - Campos opcionais (originId, debtorId) devem ser omitidos quando vazios
// - recurrenceType no backend aceita: monthly | yearly | custom (mapear weekly -> custom)
//
type BackendExpensePayload = Omit<ExpensePayload, "amount" | "sharedAmount" | "originId" | "debtorId" | "recurrenceType"> & {
  amount: string;
  sharedAmount?: string;
  originId?: string;
  debtorId?: string;
  recurrenceType?: "monthly" | "yearly" | "custom" | null;
};

function toMoneyString(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toFixed(2);
}

function normalizeExpensePayload(payload: ExpensePayload): BackendExpensePayload {
  const normalized: BackendExpensePayload = {
    ...payload,
    amount: toMoneyString(payload.amount),
  } as BackendExpensePayload;

  // sharedAmount é opcional
  if (payload.sharedAmount != null) {
    normalized.sharedAmount = toMoneyString(payload.sharedAmount as number);
  } else {
    delete (normalized as any).sharedAmount;
  }

  // originId/debtorId: omite se vazio/null
  if (payload.originId) normalized.originId = payload.originId || undefined;
  else delete (normalized as any).originId;

  if (payload.debtorId) normalized.debtorId = payload.debtorId || undefined;
  else delete (normalized as any).debtorId;

  // recurrenceType: mapear weekly -> custom; manter monthly/yearly; omitir se nulo/undefined
  if (payload.recurrenceType) {
    normalized.recurrenceType = payload.recurrenceType === "weekly" ? "custom" : payload.recurrenceType;
  } else {
    delete (normalized as any).recurrenceType;
  }

  return normalized;
}

const MONTH_FALLBACK = () => {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
  };
};

const parseMonthParams = (month: string) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return MONTH_FALLBACK();
  }
  const [year, monthPart] = month.split("-");
  return { year, month: monthPart };
};

const normalizeBillingMonth = (value: string) => {
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  const fallback = MONTH_FALLBACK();
  return `${fallback.year}-${fallback.month}`;
};

export async function getExpenses(
  month: string,
  mode: "calendar" | "billing" = "calendar",
  page = 1,
  limit = 20
): Promise<ExpensesResponse> {
  const params: Record<string, string | number> = { mode, page, limit };
  if (mode === "billing") {
    params.month = normalizeBillingMonth(month);
  } else {
    const calendar = parseMonthParams(month);
    params.year = calendar.year;
    params.month = calendar.month;
  }

  const { data } = await api.get("/api/expenses", {
    params,
    headers: { "Cache-Control": "no-cache" },
  });
  return ExpensesResponseSchema.parse(data);
}

export async function getRecurringExpenses(): Promise<Expense[]> {
  const { data } = await api.get<Expense[]>("/api/expenses/recurring");
  return ExpensesSchema.parse(data);
}

export async function getSharedExpenses(): Promise<Expense[]> {
  const { data } = await api.get<Expense[]>("/api/expenses/shared");
  return ExpensesSchema.parse(data);
}

export async function createExpense(payload: ExpensePayload): Promise<Expense> {
  const body = normalizeExpensePayload(payload);
  const { data } = await api.post<Expense>("/api/expenses", body);
  return ExpenseSchema.parse(data);
}

export async function createExpensesBatch(payloads: ExpensePayload[]): Promise<Expense[]> {
  if (!payloads.length) return [];
  const body = payloads.map((payload) => normalizeExpensePayload(payload));
  const { data } = await api.post<Expense[]>("/api/expenses/batch", body);
  return ExpensesSchema.parse(data);
}

export async function updateExpense(
  id: string,
  payload: ExpensePayload
): Promise<Expense> {
  const body = normalizeExpensePayload(payload);
  const { data } = await api.patch<Expense>(`/api/expenses/${id}/adjust`, body);
  return ExpenseSchema.parse(data);
}

export async function deleteExpense(id: string) {
  await api.delete(`/api/expenses/${id}`);
}

export async function duplicateExpense(
  id: string,
  options: { incrementMonth?: boolean; customDate?: string } = { incrementMonth: true }
) {
  await api.post(`/api/expenses/${id}/duplicate`, options);
}

export async function createRecurringExpense(payload: ExpensePayload) {
  const body = normalizeExpensePayload(payload);
  await api.post("/api/expenses/recurring", body);
}

export async function bulkUpdateExpenses(payload: BulkUpdatePayload) {
  const { data } = await api.post<{ jobId: string; status: string }>("/api/expenses/bulkUpdate", payload);
  return data;
}

export async function bulkExpensesAction(payload: BulkUnifiedActionPayload) {
  const { data } = await api.post<{ deletedCount: number; updatedCount: number; status: string }>(
    "/api/expenses/bulk",
    payload
  );
  return data;
}
