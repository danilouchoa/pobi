import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { authBff, toAuthBffError } from "../bff/client";
import type { VerifyEmailErrorCode } from "../bff/types";
import { Alert } from "../../../ui/Alert";
import { Button } from "../../../ui/Button";
import { tokens } from "../../../ui/tokens";
import { AuthShell } from "../components/AuthShell";

type Feedback = {
  variant: "success" | "info" | "warning" | "error";
  title: string;
  message: string;
  code?: string;
};

type ViewState = "idle" | "loading" | "resolved";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { isAuthenticated, updateUser, markEmailVerified } = useAuth();

  const [viewState, setViewState] = useState<ViewState>(token ? "loading" : "resolved");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [ctaLabel, setCtaLabel] = useState<string | null>(null);
  const [ctaAction, setCtaAction] = useState<() => void>(() => () => {});
  const hasRequestedRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [viewState]);

  const goToDashboard = useCallback(() => navigate("/", { replace: true }), [navigate]);
  const goToLogin = useCallback(() => navigate("/auth/login", { replace: true }), [navigate]);
  const goToCheckEmail = useCallback(() => navigate("/auth/check-email", { replace: true }), [navigate]);

  const setPrimaryAction = useCallback((label: string, action: () => void) => {
    setCtaLabel(label);
    setCtaAction(() => action);
  }, []);

  const resolveSuccess = useCallback(
    (message: string) => {
      setFeedback({
        variant: "success",
        title: "E-mail verificado",
        message,
      });

      if (isAuthenticated) {
        setPrimaryAction("Ir para o dashboard", goToDashboard);
      } else {
        setPrimaryAction("Ir para login", goToLogin);
      }
    },
    [goToDashboard, goToLogin, isAuthenticated, setPrimaryAction]
  );

  const resolveTokenError = useCallback(
    (code: VerifyEmailErrorCode | "MISSING_TOKEN" | "GENERIC_ERROR") => {
      switch (code) {
        case "INVALID_TOKEN":
        case "MISSING_TOKEN":
          setFeedback({
            variant: "error",
            title: "Link inválido",
            message: "O link de verificação é inválido ou foi alterado.",
            code,
          });
          setPrimaryAction("Voltar para login", goToLogin);
          break;
        case "TOKEN_EXPIRED":
          setFeedback({
            variant: "error",
            title: "Link expirado",
            message: "O link de verificação expirou. Solicite um novo para continuar.",
            code,
          });
          setPrimaryAction(
            isAuthenticated ? "Reenviar e-mail" : "Voltar para login",
            isAuthenticated ? goToCheckEmail : goToLogin
          );
          break;
        case "TOKEN_ALREADY_USED":
          setFeedback({
            variant: isAuthenticated ? "info" : "warning",
            title: "Link já utilizado",
            message: isAuthenticated
              ? "Seu e-mail já foi confirmado. Você pode seguir para o dashboard."
              : "Este link já foi utilizado. Acesse sua conta para continuar.",
            code,
          });
          setPrimaryAction(
            isAuthenticated ? "Ir para o dashboard" : "Ir para login",
            isAuthenticated ? goToDashboard : goToLogin
          );
          break;
        case "RATE_LIMITED":
          setFeedback({
            variant: "error",
            title: "Muitas tentativas",
            message: "Aguarde alguns minutos antes de tentar novamente.",
            code,
          });
          setPrimaryAction(isAuthenticated ? "Ir para o dashboard" : "Ir para login", isAuthenticated ? goToDashboard : goToLogin);
          break;
        default:
          setFeedback({
            variant: "error",
            title: "Não foi possível verificar",
            message: "Tivemos um problema ao validar o link. Tente novamente mais tarde.",
            code,
          });
          setPrimaryAction(isAuthenticated ? "Ir para o dashboard" : "Ir para login", isAuthenticated ? goToDashboard : goToLogin);
      }
    },
    [goToCheckEmail, goToDashboard, goToLogin, isAuthenticated, setPrimaryAction]
  );

  const verify = useCallback(
    async (verificationToken: string) => {
      if (hasRequestedRef.current === verificationToken) return;
      hasRequestedRef.current = verificationToken;

      setViewState("loading");
      setFeedback(null);

      try {
        const result = await authBff.verifyEmail(verificationToken);

        if (isAuthenticated) {
          if (result.user) {
            updateUser?.(result.user);
          } else if (result.emailVerifiedAt) {
            markEmailVerified?.(result.emailVerifiedAt);
          }
        }

        resolveSuccess("Seu e-mail foi confirmado com sucesso.");
      } catch (error: unknown) {
        const normalizedError = toAuthBffError(error);
        const code = normalizedError.code as VerifyEmailErrorCode | "GENERIC_ERROR";

        if (!verificationToken) {
          resolveTokenError("INVALID_TOKEN");
          setViewState("resolved");
          return;
        }

        resolveTokenError(code ?? "GENERIC_ERROR");
      } finally {
        setViewState("resolved");
      }
    },
    [isAuthenticated, markEmailVerified, resolveTokenError, resolveSuccess, updateUser]
  );

  useEffect(() => {
    if (!token) {
      setFeedback({
        variant: "error",
        title: "Link inválido",
        message: "O link de verificação é inválido ou incompleto.",
        code: "MISSING_TOKEN",
      });
      setPrimaryAction("Ir para login", goToLogin);
      setViewState("resolved");
      return;
    }

    verify(token);
  }, [goToLogin, token, verify]);

  const helperText = useMemo(() => {
    if (viewState === "loading") {
      return "Estamos validando seu e-mail com segurança.";
    }

    if (feedback?.code === "TOKEN_EXPIRED") {
      return "Links expiram por segurança. Você pode solicitar um novo.";
    }

    if (feedback?.code === "TOKEN_ALREADY_USED" && !isAuthenticated) {
      return "Se já criou uma conta, faça login para continuar.";
    }

    return null;
  }, [feedback, isAuthenticated, viewState]);

  return (
    <AuthShell
      variant="generic"
      title="Confirme seu e-mail"
      subtitle="Validamos o link para garantir que sua conta permaneça protegida."
      sideContent={
        <div className="auth-shell__bullet" role="presentation">
          <strong>Verificação única</strong>
          <span>Links são temporários para manter sua conta protegida.</span>
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
            {feedback?.title ?? "Verificando seu e-mail"}
          </h2>
          <p style={{ margin: 0, color: tokens.colors.mutedText, font: tokens.typography.body }}>
            {viewState === "loading"
              ? "Verificando seu e-mail..."
              : feedback?.message ?? "Aguardando confirmação do link enviado para o seu e-mail."}
          </p>
          {helperText ? (
            <p style={{ margin: 0, color: tokens.colors.neutralText, font: tokens.typography.helper }}>{helperText}</p>
          ) : null}
        </div>

        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.sm }}>
          {viewState === "loading" && !feedback ? (
            <Alert
              variant="info"
              title="Verificando seu e-mail"
              message="Aguarde enquanto validamos seu link de verificação."
            />
          ) : null}

          {feedback ? <Alert {...feedback} /> : null}
        </div>

        {viewState !== "loading" && ctaLabel ? (
          <Button
            type="button"
            label={ctaLabel}
            variant="primary"
            fullWidth
            onClick={ctaAction}
          />
        ) : (
          <Button
            type="button"
            label="Verificando..."
            variant="secondary"
            fullWidth
            isLoading
            disabled
          />
        )}

        {!isAuthenticated ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: tokens.spacing.xs,
              font: tokens.typography.body,
              color: tokens.colors.mutedText,
            }}
          >
            <span>Não recebeu o link?</span>
            <Link to="/auth/login" style={{ color: tokens.colors.primary.base, fontWeight: 600 }}>
              Fazer login
            </Link>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
