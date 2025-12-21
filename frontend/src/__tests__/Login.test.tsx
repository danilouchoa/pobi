import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../features/auth/pages/LoginPage";
import { AuthContext } from "../context/AuthProvider";
import { initialLoginErrorState, LOGIN_ERROR_MESSAGES, type LoginErrorState } from "../context/loginError";

const loginWithGoogleMock = vi.fn();
const registerMock = vi.fn();
const resolveGoogleConflictMock = vi.fn();

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess?: (payload: { credential: string }) => void }) => (
    <button type="button" onClick={() => onSuccess?.({ credential: "fake" })}>
      Google
    </button>
  ),
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({
    success: vi.fn(),
  }),
}));

type AuthOverrides = {
  login?: ReturnType<typeof vi.fn>;
  register?: ReturnType<typeof vi.fn>;
  authError?: string | null;
  loginError?: LoginErrorState;
  loading?: boolean;
};

type RenderResult = ReturnType<typeof render> & {
  setLoginError: (state: LoginErrorState) => void;
  setLoading: (value: boolean) => void;
  loginSpy: ReturnType<typeof vi.fn>;
};

function renderWithAuth(overrides: AuthOverrides = {}): RenderResult {
  let setLoginErrorState: React.Dispatch<LoginErrorState> = () => {};
  let setLoadingState: React.Dispatch<React.SetStateAction<boolean>> = () => {};
  const loginSpy = overrides.login ?? vi.fn();

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const [loginError, setLoginError] = useState<LoginErrorState>(overrides.loginError ?? initialLoginErrorState);
    const [loading, setLoading] = useState<boolean>(overrides.loading ?? false);

    setLoginErrorState = setLoginError;
    setLoadingState = setLoading;

    const value = {
      login: loginSpy,
      register: overrides.register ?? registerMock,
      loginWithGoogle: loginWithGoogleMock,
      resolveGoogleConflict: resolveGoogleConflictMock,
      authError: overrides.authError ?? null,
      loading,
      loginError,
      clearLoginError: () => setLoginError(initialLoginErrorState),
    };

    return (
      <AuthContext.Provider value={value}>
        <LoginPage />
      </AuthContext.Provider>
    );
  };

  return {
    ...render(
      <MemoryRouter initialEntries={["/auth/login"]}>
        <Wrapper />
      </MemoryRouter>
    ),
    setLoginError: (state: LoginErrorState) => setLoginErrorState(state),
    setLoading: (value: boolean) => setLoadingState(value),
    loginSpy,
  };
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits login with trimmed email and no errors on success", async () => {
    const loginSpy = vi.fn().mockResolvedValueOnce({});
    renderWithAuth({ login: loginSpy });

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: " user@finfy.com  " } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });

    const enterButtons = screen.getAllByRole("button", { name: /Entrar/i });
    fireEvent.click(enterButtons[enterButtons.length - 1]);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({ email: "user@finfy.com", password: "Password123" });
    });

    expect(screen.queryByText(LOGIN_ERROR_MESSAGES.NETWORK)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/i)).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows inline error for invalid credentials without global alert", async () => {
    let setLoginErrorState: (state: LoginErrorState) => void = () => {};
    const loginSpy = vi.fn(async () => {
      setLoginErrorState({ kind: "INVALID_CREDENTIALS", message: LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS });
      throw new Error("INVALID_CREDENTIALS");
    });

    const { setLoginError } = renderWithAuth({ login: loginSpy });
    setLoginErrorState = setLoginError;

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar/i }).pop()!);

    const inlineMessages = await screen.findAllByText(LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS);
    expect(inlineMessages).toHaveLength(2);
    expect(screen.getByLabelText(/E-mail/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Senha/i)).toHaveAttribute("aria-invalid", "true");
    const alerts = screen.queryAllByRole("alert");
    expect(alerts.some((alert) => alert.textContent?.includes(LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS))).toBe(false);
    expect(screen.queryByText(LOGIN_ERROR_MESSAGES.SESSION_EXPIRED)).not.toBeInTheDocument();
  });

  it("shows global alert for session expiration without inline credential errors", async () => {
    let setLoginErrorState: (state: LoginErrorState) => void = () => {};
    const loginSpy = vi.fn(async () => {
      setLoginErrorState({ kind: "SESSION_EXPIRED", message: LOGIN_ERROR_MESSAGES.SESSION_EXPIRED });
      throw new Error("SESSION_EXPIRED");
    });

    const { setLoginError } = renderWithAuth({ login: loginSpy });
    setLoginErrorState = setLoginError;

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar/i }).pop()!);

    await waitFor(() => {
      expect(screen.getByText(LOGIN_ERROR_MESSAGES.SESSION_EXPIRED)).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Senha/i)).not.toHaveAttribute("aria-invalid", "true");
  });

  it("renders network error as global alert", async () => {
    let setLoginErrorState: (state: LoginErrorState) => void = () => {};
    const loginSpy = vi.fn(async () => {
      setLoginErrorState({ kind: "NETWORK", message: LOGIN_ERROR_MESSAGES.NETWORK });
      throw new Error("NETWORK");
    });

    const { setLoginError } = renderWithAuth({ login: loginSpy });
    setLoginErrorState = setLoginError;

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar/i }).pop()!);

    await waitFor(() => {
      expect(screen.getByText(LOGIN_ERROR_MESSAGES.NETWORK)).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/i)).not.toHaveAttribute("aria-invalid", "true");
  });

  it("renders server error alert", async () => {
    let setLoginErrorState: (state: LoginErrorState) => void = () => {};
    const serverMessage = "Ocorreu um erro inesperado. Tente novamente em alguns instantes.";
    const loginSpy = vi.fn(async () => {
      setLoginErrorState({ kind: "SERVER", message: serverMessage });
      throw new Error("SERVER");
    });

    const { setLoginError } = renderWithAuth({ login: loginSpy });
    setLoginErrorState = setLoginError;

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Entrar/i }).pop()!);

    await waitFor(() => {
      expect(screen.getByText(serverMessage)).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/i)).not.toHaveAttribute("aria-invalid", "true");
  });

  it("disables submit while loading and prevents double submission", async () => {
    let setLoadingState: (value: boolean) => void = () => {};
    let resolveLogin: () => void = () => {};
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });

    const loginSpy = vi.fn(async () => {
      setLoadingState(true);
      await loginPromise;
      setLoadingState(false);
    });

    const { setLoading } = renderWithAuth({ login: loginSpy });
    setLoadingState = setLoading;

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@finfy.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });

    const submitButton = screen.getAllByRole("button", { name: /Entrar/i }).pop()!;
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();

    resolveLogin();

    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });
});
