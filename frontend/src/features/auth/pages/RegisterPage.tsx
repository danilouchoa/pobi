import { FormEvent, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../hooks/useToast";
import { TERMS_VERSION } from "../../../constants/auth";
import { Alert } from "../../../ui/Alert";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { TextField } from "../../../ui/TextField";
import { tokens } from "../../../ui/tokens";
import { AuthShell } from "../components/AuthShell";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

type FieldErrors = {
  email?: string;
  password?: string;
  terms?: string;
};

type SignupForm = {
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
};

type ApiError = {
  response?: {
    status?: number;
    data?: { message?: string; error?: string; errors?: Record<string, string> };
  };
};

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupForm>({
    name: "",
    email: "",
    password: "",
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lgpdCopy = useMemo(
    () => [
      "Usamos seu e-mail para login seguro, recuperação de senha e comunicações essenciais.",
      "Dados financeiros que você adicionar depois ficam restritos à sua organização pessoal dentro do app.",
      "Qualquer compartilhamento com bancos ou fintechs dependerá de consentimentos específicos, explícitos e revogáveis.",
    ],
    []
  );

  const handleChange = (key: keyof SignupForm) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = key === "acceptedTerms" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {};
    if (!EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = "Digite um e-mail válido.";
    }
    if (!PASSWORD_REGEX.test(form.password)) {
      nextErrors.password = "Senha deve ter 8+ caracteres com letras e números.";
    }
    if (!form.acceptedTerms) {
      nextErrors.terms = "Você precisa aceitar os Termos de Uso e a Política de Privacidade.";
    }
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: form.name.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        acceptedTerms: true,
        termsVersion: TERMS_VERSION,
      });
      toast.success({ message: "Conta criada com sucesso." });
      navigate("/auth/check-email", { replace: true });
    } catch (error: unknown) {
      const typedError = error as ApiError;
      const status = typedError.response?.status;
      const message = typedError.response?.data?.message;

      if (status === 409) {
        setErrors({ email: "Este e-mail já está em uso." });
        return;
      }

      if (status === 400 || status === 422) {
        const fieldMessage = typedError.response?.data?.errors?.email ?? typedError.response?.data?.errors?.password;
        if (fieldMessage) {
          setSubmitError(fieldMessage);
          return;
        }
        setSubmitError(message ?? "Revise os dados informados e tente novamente.");
        return;
      }

      setSubmitError(message ?? "Não foi possível criar sua conta agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      variant="signup"
      title="Crie sua conta sem fornecer dados financeiros"
      subtitle="Campos essenciais, consentimento explícito e comunicação transparente desde o primeiro acesso."
      sideContent={
        <div className="auth-shell__bullet" role="presentation">
          <strong>LGPD primeiro</strong>
          <span>Consentimento granular, dados mínimos e transparência sobre o uso das suas informações.</span>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}
      >
        {submitError ? (
          <Alert
            variant="error"
            title="Não foi possível criar sua conta"
            message={submitError}
            role="alert"
            style={{ borderRadius: tokens.radii.lg }}
          />
        ) : null}

        <TextField
          id="name"
          name="name"
          label="Nome (opcional)"
          placeholder="Como quer ser chamado"
          value={form.name}
          onChange={handleChange("name")}
          fullWidth
          autoComplete="name"
        />

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
          error={errors.email}
        />

        <TextField
          id="password"
          name="password"
          type="password"
          label="Senha"
          placeholder="Crie uma senha forte"
          value={form.password}
          onChange={handleChange("password")}
          required
          fullWidth
          helperText="Mínimo de 8 caracteres, combinando letras e números."
          onToggleVisibilityLabel="Mostrar ou ocultar senha"
          error={errors.password}
        />

        <Checkbox
          id="acceptedTerms"
          name="acceptedTerms"
          label={
            <span>
              Eu li e aceito os{" "}
              <a href="/terms" target="_blank" rel="noreferrer">
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                Política de Privacidade
              </a>
              .
            </span>
          }
          required
          helperText="Consentimento obrigatório para criar sua conta."
          error={errors.terms}
          checked={form.acceptedTerms}
          onChange={handleChange("acceptedTerms")}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xs }}>
          {lgpdCopy.map((item) => (
            <p key={item} style={{ margin: 0, color: tokens.colors.mutedText, font: tokens.typography.helper }}>
              {item}
            </p>
          ))}
        </div>

        <Button
          type="submit"
          label={isSubmitting ? "Criando conta..." : "Criar conta"}
          variant="primary"
          fullWidth
          isLoading={isSubmitting}
          disabled={isSubmitting}
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
      </form>
    </AuthShell>
  );
}
