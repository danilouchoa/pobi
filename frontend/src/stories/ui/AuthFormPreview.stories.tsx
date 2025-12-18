import type { Meta, StoryObj } from "@storybook/react";
import { useState, type FormEvent } from "react";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { AuthShell } from "../../components/auth/AuthShell";
import { LOGIN_ERROR_MESSAGES } from "../../context/loginError";

type AuthFormPreviewProps = {
  emailError?: string;
  passwordError?: string;
  alertMessage?: string | null;
  alertVariant?: "error" | "warning";
};

function AuthFormPreview({ emailError, passwordError, alertMessage, alertVariant = "error" }: AuthFormPreviewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }
    setError(null);
    // Simulação apenas para Storybook
  };

  return (
    <AuthShell
      title="Entrar no Finfy"
      subtitle="Sessão segura com cookies httpOnly. Use apenas os campos essenciais."
      variant="login"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {(alertMessage || error) && (
          <Alert variant={alertMessage ? alertVariant : "error"} message={alertMessage ?? error ?? ""} />
        )}
        <TextField
          label="E-mail"
          name="email"
          type="email"
          placeholder="voce@finfy.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          helperText="Usaremos o e-mail apenas para autenticação e avisos essenciais."
          error={emailError}
        />
        <TextField
          label="Senha"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          helperText="Mínimo de 8 caracteres com letras e números."
          error={passwordError}
        />
        <Button label="Entrar" variant="primary" fullWidth type="submit" />
        <Button label="Criar conta" variant="ghost" fullWidth />
      </form>
    </AuthShell>
  );
}

const meta: Meta<typeof AuthFormPreview> = {
  title: "UI/AuthFormPreview",
  component: AuthFormPreview,
  args: {
    emailError: undefined,
    passwordError: undefined,
    alertMessage: null,
    alertVariant: "error",
  },
};

export default meta;
type Story = StoryObj<typeof AuthFormPreview>;

export const Preview: Story = {};

export const InlineInvalidCredentials: Story = {
  args: {
    passwordError: LOGIN_ERROR_MESSAGES.INVALID_CREDENTIALS,
  },
};

export const NetworkErrorAlert: Story = {
  args: {
    alertMessage: LOGIN_ERROR_MESSAGES.NETWORK,
    alertVariant: "warning",
  },
};
