# POBI · Finance App Project

![Backend CI](https://img.shields.io/badge/CI-backend%20%7C%20frontend%20%7C%20images-0A74DA?logo=githubactions)
![Security Scanners](https://img.shields.io/badge/Security-Qodana%20%7C%20CodeQL%20%7C%20Dependabot-7a3e9d?logo=securityscorecard)
![Node.js](https://img.shields.io/badge/node-20.x-026e00?logo=node.js)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Tabela de Conteúdos
- [1. Overview](#1-overview)
- [2. Arquitetura do Monorepo](#2-arquitetura-do-monorepo)
- [3. Estrutura de Pastas](#3-estrutura-de-pastas)
- [4. Principais Features](#4-principais-features)
- [5. Tecnologias](#5-tecnologias)
- [6. Como rodar em ambiente local](#6-como-rodar-em-ambiente-local)
- [7. Fluxo de desenvolvimento](#7-fluxo-de-desenvolvimento)
- [8. Pipelines de CI/CD](#8-pipelines-de-cicd)
- [9. Como rodar testes](#9-como-rodar-testes)
- [10. Roadmap](#10-roadmap)
- [11. Contribuição](#11-contribuição)
- [12. Licença](#12-licença)

## 1. Overview
Monorepo de controle financeiro com frontend React/Vite e backend Node/Express + Prisma para MongoDB, enriquecido por workers assíncronos via RabbitMQ, cache Redis por usuário/mês e autenticação com tokens em memória + refresh em cookie httpOnly. O projeto prioriza validação robusta (Zod), segurança de sessão, observabilidade por healthchecks e pipelines CI/CD maduros.

## 2. Arquitetura do Monorepo
```
frontend (Vite + React + MUI)
        │
        ▼
backend API (Express + Prisma)
        │  ├─ MongoDB (dados financeiros)
        │  ├─ Redis (cache mensal por usuário)
        │  ├─ RabbitMQ (fila principal)
        │  └─ DLQ (dead-letter-queue)
        ▼
Workers (recurringWorker.ts | bulkWorker.ts)
```
- Docker multi-stage para backend e frontend, publicando imagens leves para runtime.
- Workers compartilham o mesmo build do backend e consomem filas específicas para recorrência e operações em lote.
- Cache e billingMonth centralizados garantem consultas determinísticas mesmo em diferentes timezones.

## 3. Estrutura de Pastas
- `backend/`: API Express 5 com Prisma, validação Zod, filas RabbitMQ, Redis cache e scripts de billing.
- `frontend/`: React + Vite + MUI + TanStack Query, Storybook e suíte de testes com Vitest/RTL.
- `infra/`: status e artefatos de Terraform/EKS, bootstrap e scripts auxiliares.
- `helm/`: charts e manifests Helm/ArgoCD utilizados pelas pipelines de deploy.
- `scripts/`: utilitários de manutenção e automação.
- `docker-compose.yaml`: orquestração local dos serviços (API, workers, frontend e MongoDB).
- `MIGRATION_ENUM_BILLING.md`: histórico de migração do enum de faturamento.

## 4. Principais Features
- **Parcelas agrupadas**: criação de despesas parceladas gera `installmentGroupId` único reutilizado por todas as parcelas.
- **Exclusão segura por grupo**: deleção unitária ou agrupada respeita o `installmentGroupId`, evitando cascatas incorretas.
- **billingMonth automático**: cálculo determinístico via `deriveBillingMonth` considerando `closingDay` e enum `NEXT/PREVIOUS` para rollover.
- **Cache de consultas mensais**: cache Redis por usuário/mês em modo `billing`, com logs `[CACHE HIT/MISS]` e invalidação após mutações.
- **Dead Letter Queue (DLQ)**: filas configuradas com retry + backoff e roteamento de mensagens falhas para `dead-letter-queue`.
- **Segurança**: validação Zod em rotas, cookies httpOnly para refresh token, access token somente em memória e CORS dinâmico baseado em envs.

## 5. Tecnologias
- **Frontend**: React 19, Vite 7, MUI 6, TanStack Query 5, Axios com interceptors, Storybook 10 (upgrade para v17 em análise).
- **Backend**: Node 20, Express 5, Prisma 6 (MongoDB), Redis (Upstash compatível), RabbitMQ (DLQ + ConfirmChannel), Zod, Helmet, CORS dinâmico.
- **Workers**: `recurringWorker` para recorrências e `bulkWorker` para operações em lote, ambos com reconexão e backoff exponencial.
- **Testes**: Vitest + Supertest (backend) e Vitest + React Testing Library (frontend), cobertura disponível em workflows.
- **Docker**: builds multi-stage para reduzir surface de ataque e otimizar cold start.
- **CI/CD**: GitHub Actions com pipelines dedicadas para backend, frontend, build de imagens, scanners (Qodana/CodeQL) e sincronização ArgoCD; Helm/EKS planejados no fluxo de deploy.

## 6. Como rodar em ambiente local (docker-compose up)
1. Configure `.env` em `backend/` e `frontend/` (tokens JWT, URLs de fila/cache, variáveis Vite).
2. Execute:
   ```bash
   docker-compose up -d --build
   ```
3. Endpoints principais:
   - API: `http://localhost:4000/api`
   - Frontend: `http://localhost:5173`
   - MongoDB: `localhost:27017`
4. Healthcheck disponível em `/api/health` garante readiness antes de subir frontend/workers.

## 7. Fluxo de desenvolvimento (branching + commits padronizados)
- Branch `main` protegida por pipelines verdes (backend/frontend/build-images/qodana/codeql).
- Crie feature branches a partir de `main` (`feature/`, `fix/`, `refactor/`).
- Commits seguem o template: `[Feature|Refactor|Fix|Security] Descrição concisa`. Cite o milestone quando aplicável.
- Pull Requests devem manter checks verdes e usar labels automáticas do `labeler.yml`.

## 8. Pipelines de CI/CD explicadas
- **ci-backend.yml**: Node 20, cache npm, lint, `tsc --noEmit`, testes/cobertura Vitest, publicação de artifact e deploy para ArgoCD/EKS na branch main.
- **ci-frontend.yml**: lint + build Vite + testes/cobertura com Vitest/RTL.
- **ci-build-images.yml**: build/push de imagens backend/frontend para o registry, usado em ambientes gerenciados por ArgoCD.
- **qodana_code_quality.yml & codeql.yml**: análises SAST contínuas; findings críticos bloqueiam merge.
- **cache-cleanup.yml** e **label-ready.yml**: higiene de caches e marcação de PRs prontos.
- **cd-argocd-sync.yml / deploy-dev.yaml**: sincronização de apps Helm/ArgoCD (EKS planejado, ver `infra/INFRASTRUCTURE_STATUS.md`).

## 9. Como rodar testes
- Backend:
  ```bash
  cd backend
  npm ci
  npm run lint && npx tsc --noEmit
  npm run coverage   # Vitest + Supertest
  ```
- Frontend:
  ```bash
  cd frontend
  npm ci
  npm run lint
  npm run coverage   # Vitest + React Testing Library
  npm run storybook  # Storybook local
  ```

## 10. Roadmap (Milestones v6.7.0 → v6.8.0)
- v6.7.0 (atual): parcelas agrupadas, exclusão segura, caching mensal e enum `NEXT/PREVIOUS` estabilizado.
- v6.7.x: hotfixes de deleção unitária vs agrupada e ajustes de cache/invalidations.
- v6.8.0: refino de camada service/repository, incremento de testes para fluxo de parcelas, melhoria de scanners (Semgrep/Snyk/ZAP) e adoção de ArgoCD/Helm/EKS com rollout canário.

## 11. Contribuição
- Abra issues detalhadas com escopo, riscos e impacto em billing/caching.
- Inclua testes automatizados para novas rotas, hooks ou workers.
- Respeite validações Zod e mantenha DTOs alinhados entre frontend/backend.
- Atualize documentação relevante (README, MIGRATION_ENUM_BILLING.md) ao alterar billing ou enums.

## 12. Licença
Distribuído sob a licença MIT. Consulte `LICENSE` (quando aplicável) ou confirme requisitos de compliance antes de deploys externos.
