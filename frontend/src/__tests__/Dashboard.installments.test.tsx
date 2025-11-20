import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "../pages/Dashboard";
import type { Expense, Debtor, Origin } from "../types";

const deleteInstallmentsRequest = vi.fn();
const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock("../services/expenseService", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    deleteInstallments: (...args: unknown[]) => deleteInstallmentsRequest(...args),
  };
});

vi.mock("../hooks/useToast", () => ({
  useToast: () => toast,
}));

const buildExpense = (overrides: Partial<Expense>): Expense => ({
  id: overrides.id ?? "exp",
  description: overrides.description ?? "Compra",
  category: "Outros",
  parcela: overrides.parcela ?? "Único",
  amount: 10,
  date: overrides.date ?? "2025-01-01",
  originId: overrides.originId ?? null,
  debtorId: overrides.debtorId ?? null,
  recurring: false,
  fixed: false,
  installments: overrides.installments ?? null,
  sharedWith: null,
  sharedAmount: null,
  billingMonth: null,
  installmentGroupId: overrides.installmentGroupId ?? null,
});

const baseState = {
  expenses: [
    buildExpense({ id: "a", parcela: "1/2", installmentGroupId: "grp-1" }),
    buildExpense({ id: "b", parcela: "2/2", installmentGroupId: "grp-1" }),
    buildExpense({ id: "c", parcela: "1/1", installmentGroupId: "grp-2" }),
  ],
  origins: [] as Origin[],
  debtors: [] as Debtor[],
  salaryHistory: {},
  recurringExpenses: [],
  sharedExpenses: [],
};

const renderDashboard = (stateOverrides = {}) => {
  const queryClient = new QueryClient();
  const state = { ...baseState, ...stateOverrides };
  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard
        state={state}
        month="2025-01"
        onChangeMonth={() => {}}
        viewMode="calendar"
        onChangeViewMode={() => {}}
      />
    </QueryClientProvider>
  );
};

describe("Dashboard - exclusão de parcelas", () => {
  beforeEach(() => {
    deleteInstallmentsRequest.mockReset();
    Object.values(toast).forEach((fn) => fn.mockReset());
  });

  it("renderiza checkboxes e atualiza contador", async () => {
    renderDashboard();
    const checkboxes = screen.getAllByRole("checkbox", { name: /Selecionar parcela/i });
    expect(checkboxes).toHaveLength(3);

    await userEvent.click(checkboxes[0]);
    expect(screen.getByText("1 parcelas selecionadas")).toBeInTheDocument();
  });

  it("exibe botão inteligente conforme quantidade selecionada", async () => {
    renderDashboard();
    expect(screen.queryByRole("button", { name: /Excluir parcela/i })).toBeNull();

    await userEvent.click(screen.getAllByRole("checkbox", { name: /Selecionar parcela/i })[0]);
    expect(screen.getByRole("button", { name: /Excluir parcela/i })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("checkbox", { name: /Selecionar parcela/i })[1]);
    expect(screen.getByRole("button", { name: /Excluir parcelas/i })).toBeInTheDocument();
  });

  it("bloqueia seleção com groupId diferentes e exibe toast", async () => {
    renderDashboard();

    const parcelCheckboxes = screen.getAllByRole("checkbox", { name: /Selecionar parcela/i });
    await userEvent.click(parcelCheckboxes[0]);
    await userEvent.click(parcelCheckboxes[2]);

    await userEvent.click(screen.getByRole("button", { name: /Excluir parcela/i }));

    expect(toast.warning).toHaveBeenCalled();
    expect(screen.queryByText(/Confirmar exclusão/i)).toBeNull();
    expect(deleteInstallmentsRequest).not.toHaveBeenCalled();
  });

  it("executa o fluxo completo de exclusão com sucesso", async () => {
    deleteInstallmentsRequest.mockResolvedValueOnce(undefined);
    renderDashboard();

    const parcelCheckboxes = screen.getAllByRole("checkbox", { name: /Selecionar parcela/i });
    await userEvent.click(parcelCheckboxes[0]);
    await userEvent.click(parcelCheckboxes[1]);

    await userEvent.click(screen.getByRole("button", { name: /Excluir parcelas/i }));

    expect(screen.getByText(/Você confirma a exclusão de 2/i)).toBeInTheDocument();
    expect(screen.getByText(/#grp-1/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Confirmar exclusão/i }));

    await waitFor(() => expect(deleteInstallmentsRequest).toHaveBeenCalledWith(["a", "b"]));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Confirmar exclusão/i)).toBeNull());
    expect(screen.getByText("0 parcelas selecionadas")).toBeInTheDocument();
  });

  it("mostra loading enquanto aguarda resposta do backend", async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    deleteInstallmentsRequest.mockReturnValueOnce(pendingPromise);
    renderDashboard();

    const [firstCheckbox] = screen.getAllByRole("checkbox", { name: /Selecionar parcela/i });
    await userEvent.click(firstCheckbox);

    await userEvent.click(screen.getByRole("button", { name: /Excluir parcela/i }));
    await userEvent.click(screen.getByRole("button", { name: /Confirmar exclusão/i }));
    expect(screen.getByRole("button", { name: /Excluindo/i })).toBeInTheDocument();

    resolvePromise!();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Excluindo/i })).toBeNull());
    await waitFor(() => expect(screen.queryByText(/Confirmar exclusão/i)).toBeNull());
  });

  it("mantém o modal aberto e exibe toast vermelho quando a API falha", async () => {
    deleteInstallmentsRequest.mockRejectedValueOnce(new Error("fail"));
    renderDashboard();

    const [firstCheckbox] = screen.getAllByRole("checkbox", { name: /Selecionar parcela/i });
    await userEvent.click(firstCheckbox);

    await userEvent.click(screen.getByRole("button", { name: /Excluir parcela/i }));
    await userEvent.click(screen.getByRole("button", { name: /Confirmar exclusão/i }));

    await waitFor(() => expect(deleteInstallmentsRequest).toHaveBeenCalledWith(["a"]));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText(/Confirmar exclusão/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluindo/i })).toBeNull();
    expect(screen.getByText("1 parcelas selecionadas")).toBeInTheDocument();
  });
});
