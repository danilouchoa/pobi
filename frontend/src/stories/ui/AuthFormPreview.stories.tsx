import type { Meta, StoryObj } from "@storybook/react";
import { useState, type FormEvent } from "react";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { TextField } from "../../ui/TextField";

function AuthFormPreview() {
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
    <div style={{ maxWidth: "420px", margin: "0 auto" }}>
      <Card
        title="Entrar no Finfy"
        description="Sessão segura com cookies httpOnly. Use apenas os campos essenciais."
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && <Alert variant="error" message={error} />}
          <TextField
            label="E-mail"
            name="email"
            type="email"
            placeholder="voce@finfy.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            helperText="Usaremos o e-mail apenas para autenticação e avisos essenciais."
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
          />
          <Button label="Entrar" variant="primary" fullWidth type="submit" />
          <Button label="Criar conta" variant="ghost" fullWidth />
        </form>
      </Card>
    </div>
  );
}

const meta: Meta<typeof AuthFormPreview> = {
  title: "UI/AuthFormPreview",
  component: AuthFormPreview,
};

export default meta;
export const Preview: StoryObj<typeof AuthFormPreview> = {};
