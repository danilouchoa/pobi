import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type CSSProperties,
} from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { useToast } from "../hooks/useToast";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { tokens } from "../ui/tokens";
import { AuthShell } from "./auth/AuthShell";

type Mode = "login" | "register";
type FeedbackSource = "local" | "auth";

type Feedback = {
  id: string;
  severity: "success" | "info" | "warning" | "error";
  message: string;
  dismissible?: boolean;
  source: FeedbackSource;
  autoClose?: number;
};

type GoogleConflict = {
  credential: string;
  email?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const MotionDiv = motion.div;

export default function Login() {
  const { login, register, loginWithGoogle, resolveGoogleConflict, authError, loading } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "", name: "", passwordConfirm: "" });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [googleConflict, setGoogleConflict] = useState<GoogleConflict | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const showFeedback = useCallback((severity: Feedback["severity"], message: string, options: Partial<Feedback> = {}) => {
    const { autoClose, dismissible = severity !== "success", source = "local" } = options;

    setFeedback({
      id: `${Date.now()}-${Math.random()}`,
      severity,
      message,
      dismissible,
      source,
      autoClose: autoClose ?? (severity === "success" ? 2500 : severity === "info" ? 4000 : undefined),
    });
  }, []);

  useEffect(() => {
    if (authError) {
      showFeedback("error", authError, { source: "auth" });
    } else {
      setFeedback((prev) => (prev?.source === "auth" ? null : prev));
    }
  }, [authError, showFeedback]);

  useEffect(() => {
    if (!feedback?.autoClose) return undefined;

    const timer = window.setTimeout(() => {
      setFeedback((prev) => (prev?.id === feedback.id ? null : prev));
    }, feedback.autoClose);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const emailValue = form.email.trim();
    const passwordValue = form.password;
    const nameValue = form.name.trim();

    if (!EMAIL_REGEX.test(emailValue)) {
      showFeedback("error", "Digite um e-mail válido.");
      return;
    }

    if (mode === "login") {
      if (!passwordValue.trim()) {
        showFeedback("error", "Informe e-mail e senha para continuar.");
        return;
      }

      if (emailValue !== form.email) {
        setForm((prev) => ({ ...prev, email: emailValue }));
      }

      try {
        await login({ email: emailValue, password: passwordValue });
        toast.success({ message: "Login realizado! Bem-vindo de volta." });
        showFeedback("success", "Login realizado! Redirecionando...");
      } catch (error: unknown) {
        const typedError = error as { response?: { data?: { message?: string } } };
        if (!typedError.response?.data?.message) {
          showFeedback("error", "Não foi possível fazer login.");
        }
      }
      return;
    }

    if (!nameValue) {
      showFeedback("error", "Informe seu nome para continuar.");
      return;
    }

    if (!PASSWORD_REGEX.test(passwordValue)) {
      showFeedback("error", "Senha deve ter 8+ caracteres com letras e números.");
      return;
    }

    if (!form.passwordConfirm || form.passwordConfirm !== passwordValue) {
      showFeedback("error", "A confirmação de senha não confere.");
      return;
    }

    try {
      await register({ name: nameValue, email: emailValue, password: passwordValue });
      toast.success({ message: "Cadastro realizado! Bem-vindo." });
      showFeedback("success", "Cadastro concluído! Redirecionando...");
    } catch (error: unknown) {
      const typedError = error as { response?: { data?: { message?: string } } };
      if (!typedError.response?.data?.message) {
        showFeedback("error", "Não foi possível concluir seu cadastro.");
      }
    }
  };

  const handleGoogleSuccess = async (res: CredentialResponse) => {
    setFeedback(null);

    const credential = res?.credential;
    if (!credential) {
      showFeedback("error", "Credencial do Google não disponível.");
      return;
    }

    setGoogleLoading(true);

    try {
      await loginWithGoogle({ credential });
      toast.success({ message: "Login com Google concluído." });
      showFeedback("success", "Login com Google concluído! Redirecionando...");
    } catch (error: unknown) {
      const typedError = error as {
        response?: { status?: number; data?: { error?: string; data?: { email?: string } } };
      };
      if (typedError.response?.status === 409 && typedError.response?.data?.error === "ACCOUNT_CONFLICT") {
        setGoogleConflict({
          credential,
          email: typedError.response.data.data?.email,
        });
        showFeedback("info", "Encontramos uma conta local com este e-mail. Deseja unificar com Google?");
      } else if (!typedError.response?.data?.error) {
        showFeedback("error", "Não foi possível autenticar com Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResolveConflict = async () => {
    if (!googleConflict?.credential) return;
    setGoogleLoading(true);
    try {
      await resolveGoogleConflict({ credential: googleConflict.credential });
      toast.success({ message: "Contas unificadas com sucesso." });
      showFeedback("success", "Contas unificadas! Redirecionando...");
      setGoogleConflict(null);
    } catch (error: unknown) {
      const typedError = error as { response?: { data?: { message?: string } } };
      if (!typedError.response?.data?.message) {
        showFeedback("error", "Não foi possível unificar as contas.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    showFeedback("error", "Erro ao autenticar com Google.");
    setGoogleLoading(false);
  };

  const handleChange = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setFeedback(null);
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setFeedback(null);
  };

  const formSubtitle = useMemo(
    () => (mode === "login" ? "Acesse com seu e-mail, senha ou Google." : "Cadastre-se em segundos para começar."),
    [mode]
  );

  const googleOverlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: tokens.radii.md,
    font: tokens.typography.body,
    color: tokens.colors.mutedText,
  };

  return (
    <AuthShell title="Controle sua vida financeira de forma simples" subtitle={formSubtitle} variant={mode === "login" ? "login" : "signup"}>
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: tokens.spacing.xs,
          }}
        >
          <Button
            type="button"
            label="Entrar"
            variant={mode === "login" ? "primary" : "ghost"}
            onClick={() => switchMode("login")}
            fullWidth
          />
          <Button
            type="button"
            label="Criar conta"
            variant={mode === "register" ? "secondary" : "ghost"}
            onClick={() => switchMode("register")}
            fullWidth
          />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
          <AnimatePresence>
            {feedback && (
              <MotionDiv
                key={feedback.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Alert
                  variant={feedback.severity === "error" ? "error" : feedback.severity === "warning" ? "warning" : feedback.severity === "success" ? "success" : "info"}
                  title={feedback.severity === "error" ? "Erro" : undefined}
                  message={feedback.message}
                  style={{ borderRadius: tokens.radii.lg }}
                />
              </MotionDiv>
            )}
          </AnimatePresence>

          {mode === "register" && (
            <TextField
              id="name"
              name="name"
              label="Nome"
              placeholder="Seu nome completo"
              value={form.name}
              onChange={handleChange("name")}
              required
              fullWidth
              autoComplete="name"
            />
          )}

          <TextField
            id="email"
            name="email"
            type="email"
            label="E-mail"
            placeholder="voce@finfy.com"
            value={form.email}
            onChange={handleChange("email")}
            required
            fullWidth
            autoComplete="email"
            inputMode="email"
            ref={emailInputRef}
          />

          <TextField
            id="password"
            name="password"
            type="password"
            label="Senha"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange("password")}
            required
            fullWidth
            helperText={mode === "login" ? "Use sua senha cadastrada." : "Mínimo de 8 caracteres com letras e números."}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onToggleVisibilityLabel="Mostrar ou ocultar senha"
          />

          {mode === "register" && (
            <TextField
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              label="Confirmar senha"
              placeholder="Repita sua senha"
              value={form.passwordConfirm}
              onChange={handleChange("passwordConfirm")}
              required
              fullWidth
              autoComplete="new-password"
              onToggleVisibilityLabel="Mostrar ou ocultar confirmação de senha"
            />
          )}

          <Button
            type="submit"
            label={loading ? (mode === "login" ? "Autenticando..." : "Criando conta...") : mode === "login" ? "Entrar" : "Criar conta"}
            variant="primary"
            fullWidth
            isLoading={loading}
          />

          <div style={{ textAlign: "center", color: tokens.colors.mutedText, font: tokens.typography.body }}>
            ou continue com
          </div>

          <div style={{ position: "relative" }}>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} useOneTap={false} />
            {googleLoading && <div style={googleOverlayStyle}>Sincronizando com Google...</div>}
          </div>
        </form>
      </div>

      {googleConflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unificar contas com Google"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: tokens.colors.overlay,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: tokens.spacing.md,
          }}
        >
          <div style={{ width: "min(420px, 100%)" }}>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
                <div>
                  <p style={{ margin: 0, color: tokens.colors.mutedText, font: tokens.typography.helper }}>
                    Detecção de conflito
                  </p>
                  <h2 style={{ margin: 0, color: tokens.colors.neutralText, font: tokens.typography.subheading }}>
                    Unificar contas com Google
                  </h2>
                  <p style={{ margin: 0, color: tokens.colors.mutedText, font: tokens.typography.body }}>
                    Encontramos uma conta local para {googleConflict.email ?? "este e-mail"}. Deseja unificar usando o Google
                    como login principal?
                  </p>
                </div>
                <div style={{ display: "flex", gap: tokens.spacing.sm, justifyContent: "flex-end" }}>
                  <Button
                    type="button"
                    label="Cancelar"
                    variant="ghost"
                    onClick={() => setGoogleConflict(null)}
                    disabled={googleLoading}
                  />
                  <Button
                    type="button"
                    label="Unificar"
                    variant="primary"
                    onClick={handleResolveConflict}
                    isLoading={googleLoading}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
