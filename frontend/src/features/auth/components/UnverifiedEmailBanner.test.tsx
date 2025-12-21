import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { UnverifiedEmailBanner } from "./UnverifiedEmailBanner";

let mockUser: any = { emailVerified: false };
const markEmailVerified = vi.fn(() => {
  mockUser = { ...mockUser, emailVerified: true };
});

vi.mock("../../../context/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    markEmailVerified,
  }),
}));

const success = vi.fn();
const warning = vi.fn();
const error = vi.fn();

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ success, warning, error, info: vi.fn() }),
}));

const resendVerification = vi.fn();

vi.mock("../bff/client", () => ({
  authBff: {
    resendVerification: (...args: unknown[]) => resendVerification(...args),
  },
  toAuthBffError: (error: unknown) => error,
}));

describe("UnverifiedEmailBanner", () => {
  beforeEach(() => {
    mockUser = { emailVerified: false };
    markEmailVerified.mockClear();
    resendVerification.mockReset();
    success.mockClear();
    warning.mockClear();
    error.mockClear();
  });

  it("renderiza o banner quando o usuário não está verificado", () => {
    render(<UnverifiedEmailBanner />);

    expect(screen.getByText(/confirme seu e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reenviar e-mail de verificação/i })).toBeInTheDocument();
  });

  it("não mostra o banner quando o usuário está verificado", () => {
    mockUser = { emailVerified: true };
    render(<UnverifiedEmailBanner />);

    expect(screen.queryByText(/confirme seu e-mail/i)).not.toBeInTheDocument();
  });

  it("exibe feedback de sucesso ao reenviar", async () => {
    resendVerification.mockResolvedValue({ status: "RESENT" });

    render(<UnverifiedEmailBanner />);

    fireEvent.click(screen.getByRole("button", { name: /reenviar e-mail de verificação/i }));

    await screen.findByText(/novo e-mail para sua caixa de entrada/i);
    expect(success).toHaveBeenCalled();
  });

  it("remove o banner quando o backend informa que já está verificado", async () => {
    resendVerification.mockResolvedValue({ status: "ALREADY_VERIFIED" });

    const { rerender } = render(<UnverifiedEmailBanner />);

    fireEvent.click(screen.getByRole("button", { name: /reenviar e-mail de verificação/i }));

    await waitFor(() => expect(markEmailVerified).toHaveBeenCalled());

    rerender(<UnverifiedEmailBanner />);
    expect(screen.queryByText(/confirme seu e-mail/i)).not.toBeInTheDocument();
  });

  it("exibe mensagem de throttling quando recebe RATE_LIMITED", async () => {
    resendVerification.mockRejectedValue({ code: "RATE_LIMITED" });

    render(<UnverifiedEmailBanner />);

    fireEvent.click(screen.getByRole("button", { name: /reenviar e-mail de verificação/i }));

    await screen.findByText(/aguarde alguns minutos/i);
    expect(warning).toHaveBeenCalled();
  });
});
