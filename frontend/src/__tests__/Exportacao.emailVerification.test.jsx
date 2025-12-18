import { fireEvent, render, screen } from "@testing-library/react";
import { vi, describe, beforeEach, afterAll, it, expect } from "vitest";
import Exportacao from "../components/Exportacao";

let mockUser = { emailVerified: false };
const navigate = vi.fn();
const info = vi.fn();
const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
const createObjectURL = vi.fn(() => "blob:url");
const revokeObjectURL = vi.fn();

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ info, success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const baseState = {
  origins: [{ id: "origin-1", name: "Cartão" }],
  debtors: [],
  expenses: [
    {
      id: "expense-1",
      date: "2024-12-05",
      description: "Compra teste",
      originId: "origin-1",
      category: "Categoria",
      parcela: "1/1",
      debtorId: null,
      amount: "123.45",
    },
  ],
  salaryHistory: {
    "2024-12": { month: "2024-12", hours: "160", hourRate: "100", taxRate: "0.1", cnae: "6202-2/00" },
  },
};

describe("Exportacao - bloqueio para e-mail não verificado", () => {
  beforeEach(() => {
    mockUser = { emailVerified: false };
    navigate.mockClear();
    info.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
  });

  afterAll(() => {
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("exibe alerta e evita exportação quando o e-mail não está verificado", () => {
    render(<Exportacao state={baseState} month="2024-12" />);

    expect(screen.getByText(/confirme seu e-mail para liberar a exportação/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /exportar lançamentos/i }));

    expect(info).toHaveBeenCalledWith(expect.stringContaining("exportar seus dados"));
    expect(navigate).toHaveBeenCalledWith("/auth/check-email");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("permite exportar quando o e-mail está verificado", () => {
    mockUser = { emailVerified: true, emailVerifiedAt: new Date().toISOString() };

    render(<Exportacao state={baseState} month="2024-12" />);

    fireEvent.click(screen.getByRole("button", { name: /exportar lançamentos/i }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
