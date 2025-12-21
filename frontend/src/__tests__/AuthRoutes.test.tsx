import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../App";

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("../features/auth/bff/client", () => ({
  authBff: {
    verifyEmail: vi.fn().mockResolvedValue({ status: "VERIFIED", emailVerified: true, emailVerifiedAt: null }),
    resendVerification: vi.fn(),
  },
  toAuthBffError: (error: unknown) => error,
}));

describe("Auth routes", () => {
  it("redirects legacy /login to /auth/login", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Acesse com seu e-mail, senha ou Google/i)).toBeInTheDocument();
  });

  it("renders check email screen for its route", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/check-email"]}>
        <App />
      </MemoryRouter>
    );

    const headings = await screen.findAllByText(/verifique seu e-mail/i);
    expect(headings.length).toBeGreaterThan(0);
  });

  it("renders verify email screen for its route", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/verify-email?token=abc"]}>
        <App />
      </MemoryRouter>
    );

    const statusMessages = await screen.findAllByText(/verificando seu e-mail/i);
    expect(statusMessages.length).toBeGreaterThan(0);
  });
});
