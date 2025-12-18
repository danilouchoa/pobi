import type { ReactNode } from "react";
import { Card } from "../../ui/Card";
import { tokens } from "../../ui/tokens";
import "./AuthShell.css";

type AuthShellVariant = "login" | "signup" | "generic";

export type AuthShellProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  sideContent?: ReactNode;
  variant?: AuthShellVariant;
};

const cssVar = (variable: string, fallback: string) => `var(${variable}, ${fallback})`;

export function AuthShell({
  title = "Controle sua vida financeira de forma simples",
  subtitle,
  children,
  sideContent,
  variant = "generic",
}: AuthShellProps) {
  const computedSubtitle =
    subtitle ??
    (variant === "login"
      ? "Acesse com segurança usando cookies httpOnly e continue de onde parou."
      : variant === "signup"
      ? "Crie sua conta em segundos e organize suas finanças com privacidade."
      : "Sessões rápidas, com foco em segurança e clareza para cada etapa de autenticação.");

  const formTitle = variant === "signup" ? "Criar conta" : title ?? "Entrar";

  const gradient = `radial-gradient(circle at 15% 20%, ${cssVar(
    "--finfy-colors-primary-muted",
    tokens.colors.primary.muted
  )}, transparent 30%),
  radial-gradient(circle at 80% 10%, rgba(14, 165, 233, 0.25), transparent 28%),
  linear-gradient(135deg, ${cssVar("--finfy-colors-primary-base", tokens.colors.primary.base)}, ${cssVar(
    "--finfy-colors-secondary-base",
    tokens.colors.secondary.base
  )})`;

  return (
    <main
      className="auth-shell"
      role="main"
      style={{
        ["--auth-shell-gradient" as string]: gradient,
        ["--auth-shell-foreground" as string]: "#f8fbff",
      }}
    >
      <div className="auth-shell__glow" aria-hidden />
      <div className="auth-shell__grid">
        <section className="auth-shell__panel" aria-label="Mensagem de boas-vindas">
          <p className="auth-shell__eyebrow">Finfy • Segurança e clareza</p>
          <h2 className="auth-shell__title">{title}</h2>
          <p className="auth-shell__subtitle">{computedSubtitle}</p>
          <div className="auth-shell__bullets">
            <div className="auth-shell__bullet" role="presentation">
              <strong>Cookies httpOnly</strong>
              <span>Proteção contra XSS para manter suas sessões seguras e estáveis.</span>
            </div>
            <div className="auth-shell__bullet" role="presentation">
              <strong>Fluxo direto</strong>
              <span>Campos essenciais e feedback rápido para entrar sem fricção.</span>
            </div>
            {sideContent}
          </div>
        </section>

        <div className="auth-shell__card">
          <Card>
            <header className="auth-shell__form-header">
              <p className="auth-shell__form-eyebrow">Acesso</p>
              <h1 className="auth-shell__form-title">{formTitle}</h1>
              <p className="auth-shell__form-subtitle">{computedSubtitle}</p>
            </header>
            <div className="auth-shell__form-body">{children}</div>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default AuthShell;
