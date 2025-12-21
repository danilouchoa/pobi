import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import RegisterPage from "../features/auth/pages/RegisterPage";
import { TERMS_VERSION } from "../constants/auth";
import { AuthContext } from "../context/AuthProvider";

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({
    success: vi.fn(),
  }),
}));

type RenderOptions = {
  register?: ReturnType<typeof vi.fn>;
};

function renderWithAuth({ register }: RenderOptions = {}) {
  const registerMock = register ?? vi.fn();

  return render(
    <MemoryRouter initialEntries={["/auth/register"]}>
      <AuthContext.Provider value={{ register: registerMock }}>
        <RegisterPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("Signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates required fields and terms", async () => {
    renderWithAuth();

    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(await screen.findByText(/Digite um e-mail válido/i)).toBeInTheDocument();
    expect(screen.getByText(/Senha deve ter 8\+ caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/precisa aceitar os Termos/i)).toBeInTheDocument();
  });

  it("submits minimal payload with consent", async () => {
    const register = vi.fn().mockResolvedValueOnce({});
    renderWithAuth({ register });

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "new@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });
    fireEvent.click(screen.getByLabelText(/Termos de Uso/i));

    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: "new@finfy.com",
        name: undefined,
        password: "Password123",
        acceptedTerms: true,
        termsVersion: TERMS_VERSION,
      });
    });
  });

  it("shows conflict feedback for duplicated email", async () => {
    const register = vi.fn().mockRejectedValueOnce({ response: { status: 409 } });
    renderWithAuth({ register });

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "dupe@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });
    fireEvent.click(screen.getByLabelText(/Termos de Uso/i));
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(await screen.findByText(/e-mail já está em uso/i)).toBeInTheDocument();
  });
});
