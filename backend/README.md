# Backend · Finance App (F0-03)

## Tabela de Conteúdos
- [1. Overview](#1-overview)
- [2. Stack](#2-stack)
- [3. Endpoints Principais](#3-endpoints-principais)
- [4. Estrutura de Pastas](#4-estrutura-de-pastas)
- [5. BillingMonth e Rollover](#5-billingmonth-e-rollover)
- [6. Parcelamento e installment_group_id](#6-parcelamento-e-installment_group_id)
- [7. Deleção Bulk vs Single](#7-deleção-bulk-vs-single)
- [8. Workers e DLQ](#8-workers-e-dlq)
- [9. Scripts](#9-scripts)
- [10. Docker e Variáveis de Ambiente](#10-docker-e-variáveis-de-ambiente)
- [11. Troubleshooting](#11-troubleshooting)
- [12. Roadmap](#12-roadmap)

## 1. Overview
API Node.js + Express com Prisma para MongoDB, cache Redis por usuário/mês e filas RabbitMQ para jobs de recorrência e operações em lote. Autenticação usa cookies httpOnly para refresh token, validação Zod em rotas e segurança adicional com Helmet e CORS dinâmico. O backend publica endpoints REST para auth, despesas com parcelamento agrupado, catálogos, salário e administração de DLQ.

## 2. Stack
- **Node.js + Express**: API REST com middlewares centralizados.
- **Prisma ORM**: modelos MongoDB com migrações e tipagem.
- **MongoDB**: armazenamento principal das despesas, catálogos e salário.
- **Redis**: cache por usuário + `billingMonth` para consultas em modo billing.
- **RabbitMQ**: filas `bulk-worker` e `recurring-worker` com ConfirmChannel e prefetch.
- **Zod**: validação de body/query/params para todas as rotas públicas.
- **Helmet + CORS dinâmico**: headers de segurança e allowlist por ambiente.
- **httpOnly cookies**: refresh token persistido com SameSite/secure; access token entregue ao frontend.

## 3. Endpoints Principais
Visão de alto nível (contratos detalhados nos schemas e serviços):
- `/auth`: login, registro, refresh, logout; entrega tokens e gere refresh cookie.
- `/expenses`: CRUD de despesas, criação parcelada com `installment_group_id`, filtros por `billingMonth`, `mode=billing` para consultas mensais.
- `/catalogs`: manutenção de categorias, origens e tipos de lançamento.
- `/salary`: gestão de salário e atualização mensal.
- `/admin/dlq`: estatísticas, listagem e reprocessamento/purge da dead-letter-queue.

## 4. Estrutura de Pastas
- `src/routes/`: definição de rotas Express e encadeamento de middlewares/validações.
- `src/services/`: regras de negócio e orquestração de repositórios, cache e filas.
- `src/repositories/`: camada de acesso a dados Prisma (planejada para separar persistência). 
- `src/schemas/`: validações Zod de body/query/params para cada rota.
- `src/workers/`: `bulkWorker` e `recurringWorker` com reconexão, backoff e integração com DLQ.
- `src/lib/` e `src/utils/`: helpers de billing, datas e segurança.

## 5. BillingMonth e Rollover
- Campo `billingMonth` segue formato `YYYY-MM` e indexa consultas por `userId + billingMonth`.
- Enum `billingRolloverPolicy` controla como despesas de cartão migram entre meses: `NEXT` (próximo mês) ou `PREVIOUS` (mês anterior) após ajuste para dia útil.
- Helpers `deriveBillingMonth` e `adjustToBusinessDay` calculam o mês correto no momento da criação/atualização.

## 6. Parcelamento e installment_group_id
- Criação parcelada gera um único `installment_group_id` reutilizado por todas as parcelas do lançamento.
- Cada parcela persiste quantidade total, índice da parcela e `billingMonth` resultante do cálculo de rollover.
- Atualizações ou deleções respeitam a integridade do grupo para evitar inconsistências no faturamento.

## 7. Deleção Bulk vs Single
- **Single delete**: `DELETE /expenses/:id` remove apenas a parcela solicitada, preservando as demais do grupo.
- **Bulk delete**: `DELETE /expenses/group/:installment_group_id` remove todas as parcelas do grupo quando a ação é intencionalmente agrupada.
- Cache Redis é invalidado por `billingMonth` afetado; workers de backfill não são acionados para deleção.

## 8. Workers e DLQ
- **recurringWorker**: processa lançamentos recorrentes e reaplica cálculos de billingMonth.
- **bulkWorker**: executa operações em lote (ex.: criação massiva de parcelas) com idempotência.
- **DLQ**: mensagens que excedem tentativas são roteadas para dead-letter-queue; endpoint `/admin/dlq` permite listar, reprocessar ou purgar.
- Reconexão automática ao RabbitMQ com backoff exponencial; métricas básicas registram `CACHE HIT/MISS` e tentativas de consumo.

## 9. Scripts
- `npm run dev`: modo desenvolvimento com `nodemon` + `ts-node`.
- `npm run build`: transpila TypeScript para `dist/`.
- `npm run start`: inicia servidor em produção usando `dist/index.js`.
- `npm run prisma:generate`: executa `prisma generate` (também rodado em `postinstall`).
- `npm run lint`: ESLint em toda a base.
- `npm run coverage`: testes com Vitest + Supertest.
- Scripts auxiliares: `fingerprints:backfill`, `fingerprints:regenerate`, `billing:backfill`, `billing:migrate-enum`, `test:billing`, `health:db`, `seed`, `clean`.

## 10. Docker e Variáveis de Ambiente
- Container usa imagem Node 20 com etapas separadas para build e runtime; `prisma generate` roda no estágio de build.
- Integração com Docker Compose: depende de serviços MongoDB, Redis e RabbitMQ com healthchecks configurados.
- Variáveis essenciais (exemplos):
  - `DATABASE_URL` (MongoDB), `REDIS_URL` (cache), `RABBITMQ_URL` (filas), `JWT_SECRET`, `REFRESH_TOKEN_SECRET`.
  - CORS dinâmico por `ALLOWED_ORIGINS`; cookies configurados com `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAMESITE`.
- Falha na validação de ENVs críticos interrompe o boot (Zod schemas de configuração).

## 11. Troubleshooting
- **Falha de conexão Mongo/Redis/Rabbit**: use `/api/health` para diagnosticar; verifique credenciais e reachability dos serviços do Compose.
- **401 após refresh**: confirme alinhamento de `COOKIE_DOMAIN` e secure/sameSite entre backend e frontend; limpe cookies antigos.
- **Parcelas com billing incorreto**: revise `billingRolloverPolicy` da origem e logs de cálculo em `deriveBillingMonth`.
- **DLQ crescendo**: acione `/admin/dlq` para reprocessar; avalie mensagens inválidas antes de purge.

## 12. Roadmap
- Concluir separação completa em camada de `repositories/` para isolamento de Prisma.
- Consolidar testes de exclusão unitária vs agrupada para evitar cascatas indevidas.
- Adicionar métricas de consumo de fila e logs estruturados nos workers.
- Parametrizar `SECURITY_MODE` para alternar CORS/headers entre dev e prod.
