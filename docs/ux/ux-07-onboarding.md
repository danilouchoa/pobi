# UX-07 – Pós-cadastro: onboarding rápido em 3 passos

Fluxo apresentado após a verificação de e-mail e na primeira sessão autenticada. O usuário pode pular qualquer passo ou adiar todo o wizard e retomar depois.

## Passos do wizard
1. **Nome e avatar** – captura/ajuste do nome de exibição e avatar opcional. Salva no `User`.
2. **Preferências base** – país, moeda, fuso horário e exibição (ex.: `compactMode`). Salva no `UserPreferences`.
3. **Objetivos** – seleção múltipla de metas iniciais (organizar salário, controlar gastos, sair das dívidas, investir). Persistido em `UserPreferences.goals`.

## Comportamento de skip
- **Pular passo** grava `markStepCompleted` para o passo atual e segue adiante.
- **Pular onboarding** (`POST /api/onboarding/skip`) marca `onboardingDismissedAt` e `status=DISMISSED`, não volta a redirecionar.
- **Concluir** (`POST /api/onboarding/complete`) preenche `onboardingCompletedAt` e `status=COMPLETED`.
- O backend marca `onboardingFirstPromptedAt` na primeira sessão pós-verificação de e-mail (`ensureFirstPrompted`).

## Contratos de API
- `GET /api/onboarding` → `{ profile, preferences, onboarding }` com `needsOnboarding` para gating.
- `PATCH /api/onboarding` → atualiza campos recebidos e aceita `markStepCompleted` (1|2|3).
- `POST /api/onboarding/skip` e `/complete` → atualizam status e retornam o mesmo DTO.
- `GET /api/auth/me` já retorna `onboarding` + `preferences` para o frontend decidir se redireciona.

## Frontend
- Tela em `frontend/src/pages/Onboarding.tsx` usando `AuthShell` + componentes do design system.
- Redirecionamento não bloqueante: se `user.onboarding.needsOnboarding` for verdadeiro, o app leva a `/onboarding`, mas o usuário pode sair/voltar sem perder sessão.
