export type Expense = {
  id: string;
  description: string;
  category: string;
  parcela: string;
  amount: number;
  date: string;
  originId: string | null;
  debtorId: string | null;
  recurring?: boolean;
  recurrenceType?: "monthly" | "weekly" | "yearly" | null;
  fixed?: boolean;
  installments?: number | null;
  sharedWith?: string | null;
  sharedAmount?: number | null;
};

export type ExpensePayload = {
  description: string;
  category: string;
  parcela?: string;
  amount: number;
  date: string;
  originId?: string | null;
  debtorId?: string | null;
  recurring?: boolean;
  recurrenceType?: "monthly" | "weekly" | "yearly" | null;
  fixed?: boolean;
  installments?: number | null;
  sharedWith?: string | null;
  sharedAmount?: number | null;
  incrementMonth?: boolean;
  customDate?: string;
};

export type Origin = {
  id: string;
  name: string;
  type: string;
  dueDay?: string | null;
  limit?: number | null;
  status?: string | null;
  active?: boolean;
};

export type OriginPayload = {
  name: string;
  type: string;
  dueDay?: string | null;
  limit?: number | null;
  status?: string | null;
  active?: boolean;
};

export type Debtor = {
  id: string;
  name: string;
  status?: string | null;
  active?: boolean;
};

export type DebtorPayload = {
  name: string;
  status?: string | null;
  active?: boolean;
};

export type SalaryRecord = {
  id: string;
  month: string;
  hours: number;
  hourRate: number;
  taxRate: number;
  cnae?: string | null;
};

export type SalaryPayload = {
  hours: number;
  hourRate: number;
  taxRate: number;
  cnae?: string | null;
};
