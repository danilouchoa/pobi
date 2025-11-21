# Auth Flow (feat/auth-stateless)

## Endpoints
- `/api/auth/register` (POST): cria usuário `LOCAL` com `passwordHash` (bcrypt cost 10). Conflitos:
  - `409 DUPLICATE_USER` se e-mail já existir como `LOCAL`;
  - `409 GOOGLE_ACCOUNT_EXISTS` se já houver conta `GOOGLE` para o mesmo e-mail.
- `/api/auth/login` (POST): login local; falha para contas `GOOGLE` sem `passwordHash`.
- `/api/auth/google` (POST): login social com ID token validado via `google-auth-library`. Conflito com conta `LOCAL` retorna `409 ACCOUNT_CONFLICT` e exige fluxo de merge.
- `/api/auth/google/resolve-conflict` (POST): reautentica Google e chama merge automático (Google canônico) para resolver conflito.
- `/api/auth/link/google` (POST, autenticado): vincula credencial Google à conta logada; se existir outro usuário Google, chama merge canônico.
- `/api/auth/refresh` (POST): acessa refresh token em cookie httpOnly e retorna novo access token (rota com rotação do refresh).
- `/api/auth/me` (GET): retorna usuário autenticado (`googleLinked` derivado de `googleId`).
- `/api/auth/logout` (POST): limpa cookie httpOnly.

## Tokens
- Access token (JWT, 15m): payload `{ sub, email, provider, googleLinked, tokenType: 'access' }`.
- Refresh token (JWT, 7d): payload `{ sub, email, provider, googleLinked, tokenType: 'refresh' }`, enviado apenas em cookie httpOnly (`secure` em produção, `sameSite=strict`, `domain` opcional via `COOKIE_DOMAIN`). Rotacionado em `/refresh`.
- Middleware aceita apenas `tokenType=access` e preenche `req.auth` com `userId`, `email`, `provider`, `googleLinked`.

## Google login & merge
- Validação de ID token com `OAuth2Client.verifyIdToken` (audience = `GOOGLE_CLIENT_ID`), exigindo `email_verified=true` e `payload.sub` (googleId).
- Conflitos: se houver `User` `LOCAL` com mesmo e-mail, não mescla automaticamente; retorna `ACCOUNT_CONFLICT` para o frontend disparar `/google/resolve-conflict`.
- Merge (`mergeUsersUsingGoogleAsCanonical`):
  - Reaponta `Origin`, `Debtor`, `Expense`, `SalaryHistory`, `Job` de `localUser` para `googleUser` via `updateMany`.
  - Atualiza perfil do `googleUser` (nome/avatar/passwordHash se ausentes).
  - Deleta `localUser` ao final; canônico sempre é `Provider.GOOGLE`.

## Feature flags
- `AUTH_GOOGLE_ENABLED` (default `true`): desabilita `/auth/google`, `/auth/google/resolve-conflict`, `/auth/link/google` retornando `503`.
- `AUTH_ACCOUNT_LINK_ENABLED` (default `true`): desabilita endpoints de merge/link retornando `503`.

## Observações
- CSRF continua habilitado (header `X-CSRF-Token` + cookie obtido em `/api/csrf-token`).
- `googleLinked` é retornado em todas as respostas de sessão para refletir vínculo (usado na UI).
- Seed (`prisma/seed.ts`) fica protegido por `ENABLE_DEV_SEED=true` para evitar dependência em testes/CI.
