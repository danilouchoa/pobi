import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AuthShell from "../features/auth/components/AuthShell";
import { useAuth } from "../context/useAuth";
import { getOnboarding, patchOnboarding, skipOnboarding, completeOnboarding } from "../services/onboardingService";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { FormField } from "../ui/FormField";
import { TextField } from "../ui/TextField";
import { tokens } from "../ui/tokens";
import type { OnboardingDTO } from "../types";

const GOAL_OPTIONS = [
  { id: "salary", label: "Organizar salário" },
  { id: "spending", label: "Controlar gastos" },
  { id: "debt", label: "Sair das dívidas" },
  { id: "invest", label: "Planejar investimentos" },
];

const COUNTRY_OPTIONS = [
  { value: "BR", label: "Brasil" },
  { value: "US", label: "Estados Unidos" },
  { value: "EU", label: "União Europeia" },
];

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

const TIMEZONE_OPTIONS = [
  "America/Sao_Paulo",
  "America/New_York",
  "Europe/Lisbon",
  "UTC",
];

const deriveStep = (dto: OnboardingDTO) => {
  if (dto.onboarding.step3CompletedAt) return 3;
  if (dto.onboarding.step2CompletedAt) return 2;
  if (dto.onboarding.step1CompletedAt) return 2;
  return 1;
};

const compactSelectStyle: CSSProperties = {
  width: "100%",
  padding: `${tokens.spacing.sm} ${tokens.spacing.sm}`,
  borderRadius: tokens.radii.md,
  border: `${tokens.borders.width} solid ${tokens.colors.ghost.border}`,
  background: tokens.colors.surface,
  font: tokens.typography.body,
  fontFamily: tokens.typography.fontFamily,
};

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "", []);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    avatar: "",
    countryCode: "",
    currencyCode: "",
    timezone: initialTimezone,
    compactMode: false,
    goals: [] as string[],
  });

  const syncAuthFromDto = (dto: OnboardingDTO) => {
    updateUser({
      name: dto.profile.name ?? user?.name ?? undefined,
      avatar: dto.profile.avatar ?? user?.avatar ?? undefined,
      onboarding: dto.onboarding,
      preferences: dto.preferences,
    });
  };

  const onboardingQuery = useQuery({
    queryKey: ["onboarding"],
    queryFn: getOnboarding,
    refetchOnWindowFocus: false,
  });

  // Sync auth when onboarding query succeeds
  useEffect(() => {
    if (!onboardingQuery.isSuccess || !onboardingQuery.data) {
      return;
    }

    const dto = onboardingQuery.data;
    syncAuthFromDto(dto);
    if (!dto.onboarding.needsOnboarding) {
      navigate("/", { replace: true });
      return;
    }
    setStep(deriveStep(dto));
    setForm((prev) => ({
      ...prev,
      name: dto.profile.name ?? "",
      avatar: dto.profile.avatar ?? "",
      countryCode: dto.preferences.countryCode ?? "",
      currencyCode: dto.preferences.currencyCode ?? "",
      timezone: dto.preferences.timezone ?? initialTimezone,
      compactMode: Boolean(dto.preferences.display?.compactMode),
      goals: dto.preferences.goals ?? [],
    }));
  }, [onboardingQuery.isSuccess, onboardingQuery.data, navigate, initialTimezone]);

  const patchMutation = useMutation({
    mutationFn: patchOnboarding,
  });

  // Sync auth when patch mutation succeeds
  useEffect(() => {
    if (!patchMutation.isSuccess || !patchMutation.data) {
      return;
    }

    const dto = patchMutation.data;
    queryClient.setQueryData(["onboarding"], dto);
    syncAuthFromDto(dto);
  }, [patchMutation.isSuccess, patchMutation.data, queryClient]);

  const skipMutation = useMutation({
    mutationFn: skipOnboarding,
  });

  // Sync auth and navigate when skip mutation succeeds
  useEffect(() => {
    if (!skipMutation.isSuccess || !skipMutation.data) {
      return;
    }

    const dto = skipMutation.data;
    queryClient.setQueryData(["onboarding"], dto);
    syncAuthFromDto(dto);
    navigate("/", { replace: true });
  }, [skipMutation.isSuccess, skipMutation.data, queryClient, navigate]);

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
  });

  // Sync auth and navigate when complete mutation succeeds
  useEffect(() => {
    if (!completeMutation.isSuccess || !completeMutation.data) {
      return;
    }

    const dto = completeMutation.data;
    queryClient.setQueryData(["onboarding"], dto);
    syncAuthFromDto(dto);
    navigate("/", { replace: true });
  }, [completeMutation.isSuccess, completeMutation.data, queryClient, navigate]);

  const loading = onboardingQuery.isPending;
  const saving = patchMutation.isPending || completeMutation.isPending || skipMutation.isPending;

  useEffect(() => {
    if (!loading && onboardingQuery.data && !onboardingQuery.data.onboarding.needsOnboarding) {
      navigate("/", { replace: true });
    }
  }, [loading, onboardingQuery.data, navigate]);

  const toggleGoal = (goalId: string) => {
    setForm((prev) => {
      const hasGoal = prev.goals.includes(goalId);
      return {
        ...prev,
        goals: hasGoal ? prev.goals.filter((id) => id !== goalId) : [...prev.goals, goalId],
      };
    });
  };

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 3));

  const handleSkipStep = async () => {
    try {
      await patchMutation.mutateAsync({ markStepCompleted: step as 1 | 2 | 3 });
      nextStep();
    } catch (error) {
      /* eslint-disable no-console */
      console.error("Failed to skip onboarding step:", error);
      /* eslint-enable no-console */
      window.alert("Não foi possível pular este passo. Tente novamente.");
    }
  };

  const handleContinue = async () => {
    const payload = (() => {
      if (step === 1) {
        return {
          name: form.name.trim() || undefined,
          avatar: form.avatar.trim() || undefined,
          markStepCompleted: 1 as const,
        };
      }
      if (step === 2) {
        return {
          countryCode: form.countryCode || undefined,
          currencyCode: form.currencyCode || undefined,
          timezone: form.timezone || undefined,
          display: { compactMode: form.compactMode },
          markStepCompleted: 2 as const,
        };
      }
      return {
        goals: form.goals,
        markStepCompleted: 3 as const,
      };
    })();

    try {
      await patchMutation.mutateAsync(payload);
      if (step < 3) {
        nextStep();
      }
    } catch (error) {
      /* eslint-disable no-console */
      console.error("Failed to update onboarding data in handleContinue:", error);
      /* eslint-enable no-console */
      window.alert("Não foi possível atualizar suas informações. Tente novamente.");
    }
  };

  const handleFinish = async () => {
    try {
      await patchMutation.mutateAsync({ goals: form.goals, markStepCompleted: 3 });
      await completeMutation.mutateAsync();
    } catch (error) {
      /* eslint-disable no-console */
      console.error("Failed to finish onboarding", error);
      /* eslint-enable no-console */
      window.alert("Não foi possível finalizar o onboarding. Tente novamente.");
    }
  };

  const handleSkipAll = async () => {
    try {
      await skipMutation.mutateAsync();
    } catch (error) {
      /* eslint-disable no-console */
      console.error("Failed to skip onboarding:", error);
      /* eslint-enable no-console */
      window.alert("Não foi possível pular o onboarding. Tente novamente.");
    }
  };

  const renderStep = () => {
    if (loading || !onboardingQuery.data) {
      return <p style={{ color: tokens.colors.mutedText, margin: 0 }}>Carregando onboarding...</p>;
    }

    if (step === 1) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
          <TextField
            label="Como devemos te chamar?"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Digite seu nome"
            fullWidth
          />
          <TextField
            label="Avatar (URL opcional)"
            value={form.avatar}
            onChange={(e) => setForm((prev) => ({ ...prev, avatar: e.target.value }))}
            placeholder="https://..."
            fullWidth
          />
        </div>
      );
    }

    if (step === 2) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
          <FormField id="country" label="País">
            <select
              id="country"
              value={form.countryCode}
              onChange={(e) => setForm((prev) => ({ ...prev, countryCode: e.target.value }))}
              style={compactSelectStyle}
            >
              <option value="">Selecione</option>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="currency" label="Moeda">
            <select
              id="currency"
              value={form.currencyCode}
              onChange={(e) => setForm((prev) => ({ ...prev, currencyCode: e.target.value }))}
              style={compactSelectStyle}
            >
              <option value="">Selecione</option>
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="timezone" label="Fuso horário">
            <select
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              style={compactSelectStyle}
            >
              {Array.from(
                new Set([form.timezone, ...TIMEZONE_OPTIONS].filter(Boolean))
              ).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <label htmlFor="compactMode" style={{ display: "flex", alignItems: "center", gap: tokens.spacing.xs }}>
            <input
              id="compactMode"
              type="checkbox"
              checked={form.compactMode}
              onChange={(e) => setForm((prev) => ({ ...prev, compactMode: e.target.checked }))}
              aria-label="Modo compacto para tabelas e listas"
            />
            <span style={{ color: tokens.colors.neutralText }}>Modo compacto para tabelas e listas</span>
          </label>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.sm }}>
        {GOAL_OPTIONS.map((goal) => {
          const checked = form.goals.includes(goal.id);
          const inputId = `goal-${goal.id}`;
          return (
            <label key={goal.id} htmlFor={inputId} style={{ display: "flex", alignItems: "center", gap: tokens.spacing.xs }}>
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => toggleGoal(goal.id)}
                aria-label={goal.label}
              />
              <span style={{ color: tokens.colors.neutralText }}>{goal.label}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <AuthShell
      title="Personalize sua experiência"
      subtitle="São só 3 passos rápidos. Você pode pular agora e voltar depois."
      variant="generic"
      sideContent={
        <div className="auth-shell__bullet" role="presentation">
          <strong>Progresso salvo</strong>
          <span>Avance no seu ritmo, suas escolhas ficam guardadas.</span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.lg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, color: tokens.colors.mutedText }}>Passo {step} de 3</p>
          <Button label="Pular por agora" variant="ghost" onClick={handleSkipAll} isLoading={skipMutation.isPending} />
        </div>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.lg }}>
            {renderStep()}
            <div style={{ display: "flex", gap: tokens.spacing.sm, justifyContent: "space-between", flexWrap: "wrap" }}>
              <Button
                label="Pular este passo"
                variant="ghost"
                onClick={handleSkipStep}
                disabled={saving}
              />
              {step < 3 ? (
                <Button
                  label="Continuar"
                  variant="primary"
                  onClick={handleContinue}
                  isLoading={patchMutation.isPending}
                />
              ) : (
                <Button
                  label="Concluir"
                  variant="primary"
                  onClick={handleFinish}
                  isLoading={completeMutation.isPending || patchMutation.isPending}
                />
              )}
            </div>
          </div>
        </Card>
      </div>
    </AuthShell>
  );
}
