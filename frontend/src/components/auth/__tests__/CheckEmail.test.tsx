import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import CheckEmail from "../CheckEmail";
import { AuthContext } from "../../../context/AuthProvider";
import * as authApi from "../../../services/authApi";

describe("CheckEmail", () => {
  const renderComponent = (contextValue?: Partial<React.ContextType<typeof AuthContext>>) => {
    const value = {
      isAuthenticated: true,
      user: { email: "user@finfy.com" },
      updateUser: vi.fn(),
      markEmailVerified: vi.fn(),
      ...contextValue,
    } as React.ContextType<typeof AuthContext>;

    return render(
      <MemoryRouter initialEntries={["/auth/check-email"]}>
        <AuthContext.Provider value={value}>
          <CheckEmail />
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.spyOn(authApi, "resendVerification").mockReset();
  });

  it("renders heading and tips", () => {
    renderComponent();

    expect(screen.getAllByRole("heading", { name: /verifique seu e-mail/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/confirme o endereço/i)).toBeInTheDocument();
  });

  it("shows success message when email is resent", async () => {
    vi.spyOn(authApi, "resendVerification").mockResolvedValueOnce({ status: "RESENT" });
    renderComponent();

    await userEvent.click(screen.getByRole("button", { name: /reenviar e-mail de confirmação/i }));

    expect(await screen.findByText(/novo e-mail enviado/i)).toBeInTheDocument();
  });

  it("shows info when already verified", async () => {
    vi.spyOn(authApi, "resendVerification").mockResolvedValueOnce({ status: "ALREADY_VERIFIED" });
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /reenviar e-mail de confirmação/i }));

    expect(await screen.findByText(/conta já verificada/i)).toBeInTheDocument();
  });

  it("handles rate limiting", async () => {
    const error = new Error("rate limited");
    (error as any).response = { status: 429, data: { error: "RATE_LIMITED" } };
    vi.spyOn(authApi, "resendVerification").mockRejectedValueOnce(error);
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /reenviar e-mail de confirmação/i }));

    expect(await screen.findByText(/aguarde alguns minutos/i)).toBeInTheDocument();
  });

  it("disables resend when session is missing", async () => {
    renderComponent({ isAuthenticated: false, user: null });

    const button = screen.getByRole("button", { name: /reenviar e-mail de confirmação/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/faça login para reenviar/i)).toBeInTheDocument();
  });
});
