import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import type { VerifyEmailErrorCode } from "../../services/authApi";
import { resendVerification } from "../../services/authApi";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { tokens } from "../../ui/tokens";
import { AuthShell } from "./AuthShell";

type Feedback = {
  variant: "success" | "info" | "warning" | "error";
  title?: string;
  message: string;
};

export default function CheckEmail() {
  const { isAuthenticated, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const introCopy = useMemo(
    () => [
      "Enviamos um link de confirmação para o seu e-mail.",
      "Pode levar alguns minutos e talvez apareça na caixa de spam.",
    ],
    []
  );

  const handleResend = async () => {
    if (!isAuthenticated) return;
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const result = await resendVerification();

      if (result.status === "RESENT") {
        setFeedback({
          variant: "success",
          title: "Novo e-mail enviado",
          message:
            "Enviamos um novo e-mail de confirmação. Verifique sua caixa de entrada e o spam.",
        });
      } else {
        setFeedback({
          variant: "info",
          title: "Conta já verificada",
          message: "Seu e-mail já foi confirmado. Você pode continuar para o painel normalmente.",
        });
      }
    } catch (error: unknown) {
      const typedError = error as { response?: { status?: number; data?: { error?: VerifyEmailErrorCode } } };
      const errorCode = typedError.response?.data?.error;
      const status = typedError.response?.status;

      if (status === 429 || errorCode === "RATE_LIMITED") {
        setFeedback({
          variant: "error",
          title: "Muitas tentativas",
          message: "Aguarde alguns minutos antes de solicitar um novo e-mail de confirmação.",
        });
        return;
      }

      setFeedback({
        variant: "error",
        title: "Não foi possível reenviar",
        message: "Tivemos um problema ao reenviar o e-mail. Tente novamente em instantes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiresLogin = !isAuthenticated;

  return (
    <AuthShell
      variant="signup"
      title="Verifique seu e-mail"
      subtitle="Confirme sua conta para começar a usar o Finfy com toda a segurança."
      sideContent={
        <div className="auth-shell__bullet" role="presentation">
          <strong>Reenvio seguro</strong>
          <span>Link único com validade limitada para manter sua conta protegida.</span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xs }}>
          <h2
            ref={headingRef}
            tabIndex={-1}
            style={{
              margin: 0,
              font: tokens.typography.h4,
              color: tokens.colors.neutralText,
            }}
          >
            Verifique seu e-mail
          </h2>
          <p style={{ margin: 0, color: tokens.colors.mutedText, font: tokens.typography.body }}>
            Confirme o endereço que você informou{user?.email ? ` (${user.email})` : ""} para ativar sua conta.
          </p>
          <ul style={{ paddingLeft: tokens.spacing.lg, margin: 0, color: tokens.colors.mutedText }}>
            {introCopy.map((item) => (
              <li key={item} style={{ marginBottom: tokens.spacing.xxs, font: tokens.typography.body }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.sm }}>
          {requiresLogin ? (
            <Alert
              variant="info"
              title="Faça login para reenviar"
              message="Sua sessão não está ativa. Entre novamente para solicitar um novo e-mail de confirmação."
            />
          ) : null}

          {feedback ? <Alert {...feedback} /> : null}
        </div>

        <Button
          type="button"
          label={isSubmitting ? "Reenviando..." : "Reenviar e-mail de confirmação"}
          variant="primary"
          fullWidth
          onClick={handleResend}
          isLoading={isSubmitting}
          disabled={isSubmitting || requiresLogin}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: tokens.spacing.xs,
            font: tokens.typography.body,
            color: tokens.colors.mutedText,
          }}
        >
          <span>Já tem conta?</span>
          <Link to="/auth/login" style={{ color: tokens.colors.primary.base, fontWeight: 600 }}>
            Fazer login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
