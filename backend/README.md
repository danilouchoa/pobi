# Backend · Finance App (F0-03)

## Tabela de Conteúdos
- [1. Visão Geral](#1-visão-geral)
- [2. Tecnologias](#2-tecnologias)
- [3. Scripts do package.json](#3-scripts-do-packagejson)
- [4. Estrutura de Pastas](#4-estrutura-de-pastas)
- [5. Ambiente e Configuração](#5-ambiente-e-configuração)
- [6. Fluxos Importantes](#6-fluxos-importantes)
- [7. Workers e DLQ](#7-workers-e-dlq)
- [8. Testes](#8-testes)
- [9. Troubleshooting Rápido](#9-troubleshooting-rápido)
- [10. Roadmap](#10-roadmap)

## 1. Visão Geral
API financeira em Node.js 20 + Express que controla despesas, agrupamento de parcelas por `installment_group_id`, cálculo determinístico de `billingMonth` e consulta mensal com cache Redis por usuário/mês. A persistência é feita via Prisma em MongoDB; validações usam Zod; segurança de transporte aplica Helmet e CORS dinâmico. Autenticação combina JWT com cookies httpOnly para refresh, e filas RabbitMQ orquestram jobs recorrentes, operações em lote e Dead Letter Queue (DLQ).

## 2. Tecnologias
- **Node.js 20 + Express**: base HTTP com middlewares centralizados e CORS dinâmico.
- **Prisma + MongoDB**: camada de dados tipada e migrações, usando índice por `userId + billingMonth`.
- **Redis**: cache por usuário/mês para consultas em modo billing.
- **RabbitMQ**: filas para workers bulk/recurring, com retry e DLQ.
- **Zod**: validação de body/query/params.
- **Helmet**: headers de segurança; **CORS dinâmico** com allowlist por ambiente.
- **JWT + cookies httpOnly**: access token em memória e refresh persistido com SameSite/secure.

## 3. Scripts do package.json
| Script | Descrição e uso rápido |
| --- | --- |
| `npm run dev` | Desenvolvimento com `nodemon` + `ts-node`. Ex.: `npm ci && npm run dev`. |
| `npm run build` | Transpila TypeScript para `dist/`. |
| `npm run start` | Sobe o servidor em produção a partir de `dist/index.js` (use após `npm run build` ou imagem Docker). Ex.: `npm run build && npm start`. |
| `npm run lint` | Executa ESLint em toda a base TypeScript. |
| `npm run coverage` | Roda testes com Vitest + Supertest gerando cobertura. |
| `npm run prisma:generate` / `npm run postinstall` | Gera artefatos do Prisma; `postinstall` executa automaticamente após `npm ci`. |
| `npm run billing:backfill` | Backfill de `billingMonth` para registros existentes. |
| `npm run billing:migrate-enum` | Migrações do enum de `billingRolloverPolicy` (NEXT/PREVIOUS). |
| `npm run fingerprints:backfill` / `npm run fingerprints:regenerate` | Scripts auxiliares de idempotência para lançamentos recorrentes. |
| `npm run test:billing` | Teste de unidade focado em lógica de billing. |
| `npm run health:db` | Check rápido de conectividade com MongoDB. |
| `npm run seed` | Semeia dados de desenvolvimento no banco. |
| `npm run clean` | Remove a pasta `dist/` gerada pelo build. |

## 4. Estrutura de Pastas
```
backend/
├─ src/
│  ├─ routes/          # Rotas Express e encadeamento de middlewares/validações
│  ├─ services/        # Regras de negócio e orquestração de cache/filas
│  ├─ repositories/    # Acesso a dados com Prisma (isolando persistência)
│  ├─ schemas/         # Schemas Zod de body/query/params
│  ├─ config/          # Configurações de env, CORS e segurança
│  ├─ workers/         # Workers recurring e bulk com retry/backoff
│  ├─ lib/ e utils/    # Helpers de billing, datas e segurança
│  └─ index.ts         # Bootstrap da aplicação
├─ prisma/             # Schema, migrations e seed
├─ __tests__/          # Testes unitários e de integração (Vitest/Supertest)
├─ scripts/            # Automação de billing, fingerprints e healthchecks
└─ Dockerfile
```
Responsabilidade por camada: `route` valida entrada e chama `service`; `service` aplica regras de negócio e aciona cache/filas; `repository` concentra leitura/escrita via Prisma.

## 5. Ambiente e Configuração
- Use o `.env.example` como referência e **nunca** versione `.env` reais.
- Variáveis essenciais: `DATABASE_URL` (MongoDB com `replicaSet=rs0`), `REDIS_URL` (ou `UPSTASH_REDIS_*` em produção), `RABBIT_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ALLOWED_ORIGINS`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAMESITE`. A validação Zod bloqueia o boot se algo obrigatório faltar.
- Execução via Docker Compose: o backend espera MongoDB, Redis e RabbitMQ saudáveis (ver `docker-compose.yaml` na raiz). Healthchecks dos serviços são requeridos antes do start.
- Para detalhes gerais de infraestrutura e orquestração, consulte o README raiz (`../README.md`).

## 6. Fluxos Importantes
### BillingMonth e política NEXT/PREVIOUS
- `billingMonth` segue formato `YYYY-MM` e é calculado por `deriveBillingMonth` com base em `closingDay` da origem e `billingRolloverPolicy` (`NEXT` ou `PREVIOUS`), ajustando para dia útil via `adjustToBusinessDay`.
- Queries em modo billing usam índice `userId + billingMonth` e alimentam o cache Redis por usuário/mês.

### Parcelas agrupadas (`installment_group_id`)
- Criação parcelada gera um único `installment_group_id` reutilizado em todas as parcelas do lançamento, registrando total de parcelas e posição.
- Atualizações e deleções respeitam a integridade do grupo para evitar inconsistências de faturamento e de cache.

### Deleção unitária vs. em lote
- **Unitária**: `DELETE /expenses/:id` remove apenas a parcela alvo e invalida o cache do `billingMonth` afetado.
- **Em lote**: `DELETE /expenses/group/:installment_group_id` remove todas as parcelas do grupo quando a intenção é eliminar o lançamento completo.

### Dead Letter Queue e reprocessamento
- Mensagens com falha após tentativas de retry são encaminhadas à DLQ. O fluxo padrão é: fila principal → retries com backoff → DLQ → reprocessamento manual via `/admin/dlq` ou purge.

## 7. Workers e DLQ
- **recurringWorker**: cria lançamentos recorrentes e reaplica cálculo de `billingMonth` com idempotência via fingerprints.
- **bulkWorker**: executa operações em lote (ex.: criação massiva de parcelas) usando ConfirmChannel e `prefetch` configurado.
- Ambos se reconectam ao RabbitMQ com backoff e respeitam a DLQ. Métricas básicas registram `[CACHE HIT/MISS]` e tentativas de consumo.

## 8. Testes
- Suíte principal com **Vitest** + **Supertest** para rotas e serviços. Rodar localmente: `npm ci && npm run coverage` (ou `npm run coverage -- --watch` para iteração).
- Testes unitários focados em billing podem ser executados com `npm run test:billing`.
- Integração com CI (`.github/workflows/ci-backend.yml`): etapas de `npm ci`, `npm run lint`, `npm run build` e `npm run coverage` são obrigatórias para merge.

## 9. Troubleshooting Rápido
- **Erro de conexão Mongo/Redis/RabbitMQ**: valide URLs no `.env` e use `/api/health` para checar latência/status dos serviços.
- **Prisma não gera clientes**: rode `npm run prisma:generate` ou `npm ci` para disparar o `postinstall` antes do build.
- **Mensagens presas no RabbitMQ**: verifique a DLQ via `/admin/dlq`; reprocessar somente após corrigir payload ou dependências externas.
- **Variável de ambiente ausente**: a aplicação falha no boot com erro de validação; compare com `.env.example`.
- **Cache desatualizado após deleção**: confirme se a operação foi unitária ou em grupo; invalide manualmente o Redis do `billingMonth` impactado em ambientes locais.

## 10. Roadmap
- Consolidar separação entre `services` e `repositories`, reduzindo acoplamento com Prisma.
- Ampliar testes de parcelas agrupadas (criação, deleção unitária e em grupo) com fixtures dedicados.
- Expor métricas e logs estruturados para workers e filas (observabilidade/alertas).
- Parametrizar `SECURITY_MODE` para alternar perfis de CORS/headers entre dev e prod.
- Refinar políticas de retry e reprocessamento da DLQ para casos de dependências externas.
