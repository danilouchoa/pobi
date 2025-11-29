import { render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import VerifyEmail from "../VerifyEmail";
import { AuthContext } from "../../../context/AuthProvider";
import { verifyEmail } from "../../../services/authApi";

vi.mock("../../../services/authApi", () => ({
  verifyEmail: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("VerifyEmail", () => {
  const renderComponent = (options?: {
    isAuthenticated?: boolean;
    initialPath?: string;
    updateUser?: () => void;
    markEmailVerified?: () => void;
  }) => {
    const value = {
      isAuthenticated: options?.isAuthenticated ?? false,
      user: options?.isAuthenticated ? { email: "user@finfy.com" } : null,
      updateUser: options?.updateUser ?? vi.fn(),
      markEmailVerified: options?.markEmailVerified ?? vi.fn(),
    } as React.ContextType<typeof AuthContext>;

    return render(
      <MemoryRouter initialEntries={[options?.initialPath ?? "/auth/verify-email"]}>
        <AuthContext.Provider value={value}>
          <VerifyEmail />
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error when token is missing", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /link inválido/i })).toBeInTheDocument();
    const alerts = screen.getAllByRole("alert");
    expect(alerts[0]).toHaveTextContent(/link de verificação é inválido ou incompleto/i);
    expect(screen.getByRole("button", { name: /ir para login/i })).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it("verifies token and shows success for guests", async () => {
    (verifyEmail as unknown as vi.Mock).mockResolvedValueOnce({
      status: "VERIFIED",
      emailVerified: true,
      emailVerifiedAt: "2025-01-01T00:00:00.000Z",
    });

    renderComponent({ initialPath: "/auth/verify-email?token=abc" });

    expect(await screen.findByRole("heading", { name: /e-mail verificado/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ir para login/i })).toBeInTheDocument();
  });

  it("updates authenticated user when verification succeeds", async () => {
    const updateUser = vi.fn();
    (verifyEmail as unknown as vi.Mock).mockResolvedValueOnce({
      status: "VERIFIED",
      emailVerified: true,
      emailVerifiedAt: "2025-01-02T00:00:00.000Z",
      user: { emailVerifiedAt: "2025-01-02T00:00:00.000Z" },
    });

    renderComponent({ initialPath: "/auth/verify-email?token=xyz", isAuthenticated: true, updateUser });

    expect(await screen.findByRole("heading", { name: /e-mail verificado/i })).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith({ emailVerifiedAt: "2025-01-02T00:00:00.000Z" });
    expect(screen.getByRole("button", { name: /ir para o dashboard/i })).toBeInTheDocument();
  });

  it("handles invalid token errors", async () => {
    const error = new Error("invalid");
    (error as any).response = { data: { error: "INVALID_TOKEN" } };
    (verifyEmail as unknown as vi.Mock).mockRejectedValueOnce(error);

    renderComponent({ initialPath: "/auth/verify-email?token=bad" });

    expect(await screen.findByRole("heading", { name: /link inválido/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /voltar para login/i })).toBeInTheDocument();
  });

  it("offers resend path for expired tokens when authenticated", async () => {
    const error = new Error("expired");
    (error as any).response = { data: { error: "TOKEN_EXPIRED" } };
    (verifyEmail as unknown as vi.Mock).mockRejectedValueOnce(error);

    renderComponent({ initialPath: "/auth/verify-email?token=expired", isAuthenticated: true });

    expect(await screen.findByRole("heading", { name: /link expirado/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reenviar e-mail/i })).toBeInTheDocument();
  });

  it("shows already used message for authenticated users", async () => {
    const error = new Error("used");
    (error as any).response = { data: { error: "TOKEN_ALREADY_USED" } };
    (verifyEmail as unknown as vi.Mock).mockRejectedValueOnce(error);

    renderComponent({ initialPath: "/auth/verify-email?token=used", isAuthenticated: true });

    expect(await screen.findByRole("heading", { name: /link já utilizado/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ir para o dashboard/i })).toBeInTheDocument();
  });
});
