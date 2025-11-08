import api from "./api";
import { Expense, ExpensePayload } from "../types";
import { ExpenseSchema, ExpensesSchema } from "../lib/schemas";

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

export async function getExpenses(month: string): Promise<Expense[]> {
  const params = parseMonthParams(month);
  const { data } = await api.get<Expense[]>("/api/expenses", {
    params: { year: params.year, month: params.month },
    headers: { "Cache-Control": "no-cache" },
  });
  return ExpensesSchema.parse(data);
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
