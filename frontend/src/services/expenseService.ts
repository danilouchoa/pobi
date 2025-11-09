import api from "./api";
import { Expense, ExpensePayload, ExpensesResponse, BulkUpdatePayload, BulkUnifiedActionPayload } from "../types";
import { ExpenseSchema, ExpensesResponseSchema, ExpensesSchema } from "../lib/schemas";

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
  const { data } = await api.post<Expense>("/api/expenses", payload);
  return ExpenseSchema.parse(data);
}

export async function updateExpense(
  id: string,
  payload: ExpensePayload
): Promise<Expense> {
  const { data } = await api.patch<Expense>(`/api/expenses/${id}/adjust`, payload);
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
  await api.post("/api/expenses/recurring", payload);
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
