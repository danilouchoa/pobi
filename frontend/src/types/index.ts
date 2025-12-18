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
  billingMonth?: string | null;
  installmentGroupId?: string | null;
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

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ExpensesResponse = {
  data: Expense[];
  pagination: Pagination;
};

export type BulkUpdatePayload = {
  filters: {
    expenseIds: string[];
  };
  data: {
    category?: string;
    originId?: string;
    fixed?: boolean;
    recurring?: boolean;
    recurrenceType?: "monthly" | "weekly" | "yearly" | null;
  };
  options?: {
    mode?: "calendar" | "billing";
    invalidate?: boolean;
  };
};

// Novo payload unificado (frontend) para endpoint /bulk
export type BulkDeletePayload = {
  action: 'delete';
  ids: string[];
};

export type BulkUpdateActionItem = {
  id: string;
  category?: string;
  originId?: string;
  fixed?: boolean;
  recurring?: boolean;
  recurrenceType?: "monthly" | "weekly" | "yearly" | null;
};

export type BulkUpdateActionPayload = {
  action: 'update';
  items: BulkUpdateActionItem[];
};

export type BulkUnifiedActionPayload = BulkDeletePayload | BulkUpdateActionPayload;

export type Origin = {
  id: string;
  name: string;
  type: string;
  dueDay?: string | null;
  limit?: number | null;
  status?: string | null;
  active?: boolean;
  closingDay?: number | null;
  billingRolloverPolicy?: "NEXT" | "PREVIOUS" | null;
};

export type OriginPayload = {
  name: string;
  type: string;
  dueDay?: string | null;
  limit?: number | null;
  status?: string | null;
  active?: boolean;
  closingDay?: number | null;
  billingRolloverPolicy?: "NEXT" | "PREVIOUS" | null;
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

export type OnboardingPreferences = {
  countryCode: string | null;
  currencyCode: string | null;
  timezone: string | null;
  display: Record<string, unknown> | null | undefined;
  goals: string[];
};

export type OnboardingProgress = {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  needsOnboarding: boolean;
  firstPromptedAt: string | null;
  dismissedAt: string | null;
  completedAt: string | null;
  step1CompletedAt: string | null;
  step2CompletedAt: string | null;
  step3CompletedAt: string | null;
};

export type OnboardingDTO = {
  profile: { name: string | null; avatar: string | null };
  preferences: OnboardingPreferences;
  onboarding: OnboardingProgress;
};

export type OnboardingPatch = {
  name?: string;
  avatar?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  display?: Record<string, unknown> | null;
  goals?: string[];
  markStepCompleted?: 1 | 2 | 3;
};
