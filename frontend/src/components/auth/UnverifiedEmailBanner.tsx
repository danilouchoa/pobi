import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import { resendVerification } from "../../services/authApi";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { tokens } from "../../ui/tokens";
import { useToast } from "../../hooks/useToast";

export function UnverifiedEmailBanner() {
  const { user, isAuthenticated, markEmailVerified } = useAuth();
  const { success, warning, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isAuthenticated || user?.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const response = await resendVerification();
      if (response.status === "ALREADY_VERIFIED") {
        markEmailVerified();
        success("Obrigado! Seu e-mail já estava confirmado.");
        return;
      }
      success("Enviamos um novo e-mail de verificação.");
      setFeedback("Enviamos um novo e-mail para sua caixa de entrada.");
    } catch (err: unknown) {
      const errorCode = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (errorCode === "RATE_LIMITED") {
        warning("Aguarde alguns minutos antes de solicitar um novo e-mail.");
        setFeedback("Aguarde alguns minutos antes de solicitar um novo e-mail.");
        return;
      }
      error("Não foi possível reenviar o e-mail agora. Tente novamente em instantes.");
      setFeedback("Não foi possível reenviar o e-mail agora. Tente novamente em instantes.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.sm,
        marginBottom: tokens.spacing.lg,
      }}
    >
      <Alert
        variant="warning"
        title="Confirme seu e-mail para liberar todos os recursos."
        message="Algumas integrações e exportações só ficam disponíveis após a confirmação do seu e-mail."
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: tokens.spacing.sm,
          alignItems: "center",
        }}
      >
        <Button
          label="Reenviar e-mail de verificação"
          variant="secondary"
          size="md"
          onClick={handleResend}
          isLoading={isLoading}
        />
        {feedback ? (
          <span
            style={{
              font: tokens.typography.body,
              color: tokens.colors.warning.text,
            }}
            role="status"
          >
            {feedback}
          </span>
        ) : null}
      </div>
    </div>
  );
}
