import type { Meta, StoryObj } from "@storybook/react";
import { useState, type FormEvent } from "react";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { AuthShell } from "../../features/auth/components/AuthShell";

function AuthShellPreview() {
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
  };

  return (
    <AuthShell title="Controle sua vida financeira" subtitle="Sessão segura com cookies httpOnly." variant="login">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && <Alert variant="error" message={error} />}
        <TextField
          label="E-mail"
          name="email"
          type="email"
          placeholder="voce@finfy.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Senha"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          fullWidth
          helperText="Mínimo de 8 caracteres com letras e números."
        />
        <Button label="Entrar" variant="primary" fullWidth type="submit" />
        <Button label="Criar conta" variant="ghost" fullWidth type="button" />
      </form>
    </AuthShell>
  );
}

const meta: Meta<typeof AuthShellPreview> = {
  title: "UI/AuthShell",
  component: AuthShellPreview,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
export const MobileFirst: StoryObj<typeof AuthShellPreview> = {};
export const DesktopWithHighlights: StoryObj<typeof AuthShellPreview> = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: "responsive",
    },
  },
};
