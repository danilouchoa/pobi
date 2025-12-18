import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../App";

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("../services/authApi", () => ({
  verifyEmail: vi.fn().mockResolvedValue({ status: "VERIFIED", emailVerified: true, emailVerifiedAt: null }),
  resendVerification: vi.fn(),
}));

describe("Auth routes", () => {
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
