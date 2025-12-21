import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { AuthProvider } from "../context/AuthProvider";
import { useAuth } from "../context/useAuth";
import { expensesKeys } from "../lib/queryKeys";

vi.mock("../services/api", () => ({
  __esModule: true,
  default: {
    post: vi.fn((url, payload) => {
      if (url === "/api/bff/auth/login") {
        const email = payload?.email ?? "";
        if (email === "user-a@finfy.app") {
          return Promise.resolve({
            data: { accessToken: "token-a", user: { id: "user-a", email } },
          });
        }
        if (email === "user-b@finfy.app") {
          return Promise.resolve({
            data: { accessToken: "token-b", user: { id: "user-b", email } },
          });
        }
      }
      if (url === "/api/bff/auth/logout") {
        return Promise.resolve({ data: {} });
      }
      if (url === "/api/bff/auth/refresh") {
        return Promise.resolve({ data: { accessToken: "token-a" } });
      }
      return Promise.resolve({ data: {} });
    }),
    get: vi.fn(() => Promise.resolve({ data: { user: null } })),
  },
  setAuthToken: vi.fn(),
  registerUnauthorizedHandler: vi.fn(),
}));

const SessionProbe = () => {
  const { user, login, logout } = useAuth();
  const userId = user?.id;
  const queryKey = userId
    ? expensesKeys.list({
        userId,
        month: "2025-11",
        mode: "calendar",
        page: 1,
        limit: 20,
      })
    : (["expenses", "disabled", "list"] as const);
  const { data } = useQuery({
    queryKey,
    queryFn: async () => [{ id: userId, description: `Expense-${userId}` }],
    enabled: Boolean(user?.id),
  });

  return (
    <div>
      <span data-testid="current-user">{user?.id ?? "none"}</span>
      <span data-testid="expenses">
        {data?.length ? data.map((item) => item.description).join(",") : "empty"}
      </span>
      <button onClick={() => login({ email: "user-a@finfy.app", password: "secret" })}>
        login-a
      </button>
      <button onClick={() => login({ email: "user-b@finfy.app", password: "secret" })}>
        login-b
      </button>
      <button onClick={logout}>logout</button>
    </div>
  );
};

describe("session/cache isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears cached data between sessions", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SessionProbe />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("login-a"));
    await waitFor(() => expect(screen.getByTestId("current-user").textContent).toBe("user-a"));
    await waitFor(() =>
      expect(screen.getByTestId("expenses").textContent).toContain("Expense-user-a")
    );

    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("current-user").textContent).toBe("none"));
    expect(screen.getByTestId("expenses").textContent).toBe("empty");

    fireEvent.click(screen.getByText("login-b"));
    await waitFor(() => expect(screen.getByTestId("current-user").textContent).toBe("user-b"));
    await waitFor(() =>
      expect(screen.getByTestId("expenses").textContent).toContain("Expense-user-b")
    );
    expect(screen.getByTestId("expenses").textContent).not.toContain("Expense-user-a");
  });
});
