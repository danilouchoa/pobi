import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Login from "../components/Login";

const loginMock = vi.fn();
const registerMock = vi.fn();
const loginWithGoogleMock = vi.fn();
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

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({
    login: loginMock,
    register: registerMock,
    loginWithGoogle: loginWithGoogleMock,
    resolveGoogleConflict: resolveGoogleConflictMock,
    authError: null,
    loading: false,
  }),
}));

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders shell headlines and toggles between login and register", () => {
    render(<Login />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Controle sua vida financeira de forma simples/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirmar senha/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Criar conta/i }));
    expect(screen.getByLabelText(/Confirmar senha/i)).toBeInTheDocument();
  });

  it("submits login with trimmed email", async () => {
    loginMock.mockResolvedValueOnce({});
    render(<Login />);

    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: " user@finfy.com  " } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "Password123" } });

    const enterButtons = screen.getAllByRole("button", { name: /Entrar/i });
    fireEvent.click(enterButtons[enterButtons.length - 1]);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ email: "user@finfy.com", password: "Password123" });
    });
  });
});
