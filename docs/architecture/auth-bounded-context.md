# Auth Bounded Context & Email Verification (UX-06B–UX-06F)

## Responsabilidades
- Autenticação (login, refresh, logout, Google), consentimentos e verificação de e-mail.
- Gestão de tokens de verificação (criação, TTL, consumo, janela de resend) e gating em rotas sensíveis.
- Publicação de jobs de e-mail na fila `email-jobs` (`EMAIL_VERIFICATION_QUEUE`) com payload tipado.

## Limite para microserviço futuro
- Fila `email-jobs` atua como boundary para um possível serviço de comunicações/onboarding.
- Publicadores (API) permanecem idempotentes: mesmo payload gera efeitos equivalentes; enqueue pode ser desligado via `AUTH_EMAIL_VERIFICATION_ENQUEUE_ENABLED`.
- Worker pode ser movido para outro serviço consumindo a mesma fila sem alterar contratos dos produtores.

## Sequência (registro)
```
[client] --register--> [API auth]
  -> create token (TTL configurável)
  -> enqueue VERIFY_EMAIL job (opcional, config)
      payload: { userId, email, verificationUrl, expiresAt }
  -> respond accessToken + user

[email worker]
  -> consume VERIFY_EMAIL
  -> send via provider (noop/resend)
  -> log email.verify-email.sent / failed / invalid-payload
```

## Observabilidade e falhas
- Eventos estruturados (chaves: `event`, `ts`, `requestId`, `userId`, `meta`) para criação, resend, expirado, já usado, inválido, sucesso, enqueue skipped/failed e eventos do worker.
- Token jamais logado em claro; apenas `tokenHint` (últimos 4 chars) em falhas.
- Falha no publish não derruba a API (log + resposta controlada); worker em erro registra `email.worker.fatal` e finaliza processo.

## Idempotência e janelas
- TTL configurável: `AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` (fallback aos defaults anteriores).
- Janela de resend: `AUTH_EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS`; motivo retornado em logs `resend-rate-limited`.
- Gating configurável: `AUTH_EMAIL_VERIFICATION_REQUIRED` (false em dev/test permite navegar sem bloqueio, mas com logs `gate.skipped`).

## Failover e DLQ
- Jobs que falham podem ser `nack` para retry; payload inválido é `ack` com log `invalid-payload`.
- Provider down: log `email.verify-email.failed` com `retryable=true`; estratégia de retry/DLQ segue configuração do broker.
