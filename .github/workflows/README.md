# Workflows GitHub Actions

Documentação dos pipelines ativos, seguindo o padrão corporativo do monorepo. Labels automáticas (`labeler.yml`) e a validação de checks (`label-ready.yml`) orientam o fluxo de aprovação: PRs recebem labels de escopo e só ganham `Ready to Merge` quando CI essencial estiver verde.

## ci-frontend.yml — CI Frontend
- **Objetivo:** lint, build e testes do frontend em Node 20, com deploy automatizado para EKS/ArgoCD na `main`.
- **Gatilhos:** `push` e `pull_request` para `main` com paths `frontend/`, `infra/`, `helm/` e o próprio workflow.
- **Escopo:** executa apenas em alterações do frontend/infra/helm. Deploy só em `push` para `main`.
- **Dependências:** Node 20, cache npm/Vite, VITE_GOOGLE_CLIENT_ID (fallback), AWS IAM role (`AWS_IAM_ROLE`), ECR (`AWS_ECR_REGISTRY`), ArgoCD (`ARGOCD_*`).
- **Regras de aprovação:** usado como check obrigatório para o label `Ready to Merge`.
- **Jobs:** `build-test-frontend` (lint, build, tests + coverage), `deploy-frontend-dev` (build/push imagem + sync ArgoCD + smoke test UI), `prune-caches-frontend`.
- **Observações:** cancela execuções concorrentes; artefato de cobertura; limpeza de caches GHA.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| push/pull_request (main; paths restritos) | build-test-frontend → deploy-frontend-dev (apenas push main) → prune-caches-frontend | Variável, dominada por build Docker e sync ArgoCD | Requer AWS/ArgoCD; alimenta `label-ready.yml` |

## ci-backend.yml — CI Backend
- **Objetivo:** lint, `tsc --noEmit`, testes e cobertura do backend em Node 20, com deploy automatizado para EKS/ArgoCD na `main`.
- **Gatilhos:** `push` e `pull_request` para `main` com paths `backend/`, `infra/`, `helm/` e o próprio workflow.
- **Escopo:** roda somente em mudanças do backend/infra/helm. Deploy apenas em `push` para `main`.
- **Dependências:** Node 20, cache npm, envs de frontend e OAuth (fallback), AWS (`AWS_IAM_ROLE`, `AWS_ECR_REGISTRY`), ArgoCD (`ARGOCD_*`).
- **Regras de aprovação:** check obrigatório para o label `Ready to Merge`.
- **Jobs:** `build-test-backend` (lint, `tsc`, tests + coverage), `deploy-backend-dev` (build/push imagem + sync ArgoCD + smoke test health), `prune-caches-backend`.
- **Observações:** cancela concorrência; artefato de cobertura; limpa caches GHA.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| push/pull_request (main; paths restritos) | build-test-backend → deploy-backend-dev (apenas push main) → prune-caches-backend | Variável, dominada por build Docker e sync ArgoCD | Check requerido por `label-ready.yml`; depende de AWS/ArgoCD |

## ci-build-images.yml — Build de Imagens
- **Objetivo:** build e push de imagens Docker do backend e frontend para ECR.
- **Gatilhos:** `push` para `main` com alterações em backend/frontend/docker-compose/helm/infra ou no próprio workflow.
- **Escopo:** apenas branch `main`.
- **Dependências:** Docker + AWS OIDC (`AWS_GITHUB_OIDC_ROLE_ARN`), ECR repos `finfy-backend` e `finfy-frontend`.
- **Jobs:** `build-and-push` (build com caches GHA, tags SHA+latest, push, export de artifact `image-tags`).
- **Observações:** fornece artifact consumido por `cd-argocd-sync.yml`; limpa caches GHA.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| push (main; paths restritos) | build-and-push | Variável, dominada por build Docker | Produz `image-tags` para CD; depende de login ECR |

## cd-argocd-sync.yml — Sync pós-build
- **Objetivo:** sincronizar ArgoCD após imagens publicadas.
- **Gatilhos:** `workflow_run` concluído com sucesso do workflow **CI Build Images**.
- **Escopo:** somente quando o build de imagens termina em `success`.
- **Dependências:** ArgoCD server/token (`ARGOCD_SERVER`, `ARGOCD_AUTH_TOKEN`), artifact `image-tags`.
- **Jobs:** `sync` (download artifact, extrai tags, ajusta `finfy-backend`/`finfy-frontend` via `helm-set`, `argocd app sync/wait`).
- **Observações:** usa login via token SSO; atualiza apenas tags, não builda imagens.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| workflow_run (CI Build Images = success) | sync | Curta; limitada ao sync ArgoCD | Consumidor direto do artifact `image-tags` |

## deploy-dev.yaml — Deploy Dev direto
- **Objetivo:** build/push de imagens e atualização de ArgoCD para ambiente dev diretamente na branch `main`.
- **Gatilhos:** `push` para `main`.
- **Escopo:** sempre executa nas pushes para `main` (independente de paths).
- **Dependências:** AWS IAM role (`AWS_IAM_ROLE`), ECR (`AWS_ECR_REGISTRY`), ArgoCD (`ARGOCD_*`).
- **Jobs:** `build-and-push` (Docker build/push backend e frontend), `deploy-argocd` (login ArgoCD, `helm-set` e `app sync/wait`, smoke tests HTTP).
- **Observações:** usa environment `dev`; complementa ci-build-images quando necessário.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| push (main) | build-and-push → deploy-argocd | Variável, dominada por build e sync | Usa OIDC para AWS; executa smoke tests básicos |

## codeql.yml — CodeQL Security Analysis
- **Objetivo:** varredura SAST (security-extended + security-and-quality) para backend e frontend.
- **Gatilhos:** `push`/`pull_request` para `main`; `schedule` semanal (domingo 21:33 UTC).
- **Escopo:** paths backend/frontend e próprio workflow.
- **Dependências:** Node 20, cache npm, CodeQL init/analyze.
- **Regras de aprovação:** listado como workflow monitorado por `label-ready.yml` (verifica conclusão do job `analyze`).
- **Jobs:** `analyze` matriz (backend/frontend) com install leve, init CodeQL, analyze SARIF.
- **Observações:** timeout 360 min; paths-ignore para testes/coverage/dist/stories.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| push/pull_request (main) + schedule semanal | analyze (matriz backend/frontend) | Prolongada, depende do tamanho do scan | Results enviados como SARIF; integra com `label-ready.yml` |

## qodana_code_quality.yml — Qodana
- **Objetivo:** análise Qodana Cloud para frontend e backend.
- **Gatilhos:** `pull_request` para `main` (inclusive `ready_for_review`) e `workflow_dispatch` manual.
- **Escopo:** paths backend/frontend e próprio workflow.
- **Dependências:** JetBrains Qodana action, `QODANA_TOKEN_739358186`, endpoint cloud.
- **Jobs:** `qodana` (checkout com ref do PR, scan, comentários/checks em PR).
- **Observações:** permissões de escrita em checks/PRs; usa `pr-mode: false`.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| pull_request (main) + workflow_dispatch | qodana | Variável, depende do scan na cloud | Necessita token Qodana; escreve comentários/checks |

## dependabot-auto-merge.yml — Auto-approve Dependabot
- **Objetivo:** aprovar automaticamente PRs do Dependabot (sem auto-merge).
- **Gatilhos:** `pull_request_target` (opened/synchronize/reopened).
- **Escopo:** apenas quando `github.actor` é `dependabot[bot]`.
- **Dependências:** `SECRET_GITHUB_TOKEN` para metadata e aprovação.
- **Jobs:** `approve` (checkout, fetch-metadata, auto-approve action).
- **Observações:** não faz merge automático; segue branch protection padrão.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| pull_request_target (Dependabot) | approve | Curta | Aprova PRs de dependência sem merge automático |

## labeler.yml — Pull Request Labeler
- **Objetivo:** aplicar labels automáticas conforme o arquivo `.github/labeler.yml`.
- **Gatilhos:** `pull_request` (opened/synchronize/reopened/ready_for_review), exceto rascunhos.
- **Escopo:** qualquer PR não-draft.
- **Dependências:** `SECRET_GITHUB_TOKEN`.
- **Jobs:** `labeler` (actions/labeler com config do PR).
- **Observações:** mantém labels de escopo que orientam revisões e triagem; não sincroniza labels removidas manualmente.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| pull_request (não draft) | labeler | Curta | Alimenta classificação usada na revisão e no fluxo de merge |

## label-ready.yml — Label Ready to Merge
- **Objetivo:** aplicar label `Ready to Merge` quando checks críticos estiverem verdes.
- **Gatilhos:** `workflow_run` concluído de **CI Backend**, **CI Frontend** e **CodeQL Security Analysis**.
- **Escopo:** apenas eventos originados de `pull_request`.
- **Dependências:** Github Script API, checks `build-test-backend` e `build-test-frontend` bem-sucedidos.
- **Regras de aprovação:** valida required checks antes de marcar PR; evita duplicidade de label.
- **Jobs:** `label-ready` (busca PR pelo commit/branch, verifica check runs, aplica label se sucesso).
- **Observações:** integra com branch protection; ignora PRs sem todos os checks completos.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| workflow_run (CI Backend/Frontend/CodeQL) | label-ready | Curta | Controla aplicação de `Ready to Merge` |

## cache-cleanup.yml — Limpeza de Caches
- **Objetivo:** higienizar caches antigos do GitHub Actions.
- **Gatilhos:** `schedule` semanal (domingo 03:00 UTC) e `workflow_dispatch`.
- **Escopo:** repositório inteiro.
- **Dependências:** permissões de `actions` write.
- **Jobs:** `prune-caches` (apaga caches antigos mantendo 5 mais recentes por prefixo).
- **Observações:** reduz consumo de storage e falhas por cache corrompido.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| schedule semanal + manual | prune-caches | Curta | Remove caches excedentes, preservando 5 por prefixo |

## stale.yml — Stale Issues/PRs
- **Objetivo:** marcar e fechar issues/PRs inativos.
- **Gatilhos:** `schedule` diário (09:00 UTC).
- **Escopo:** issues e PRs com inatividade >30 dias.
- **Dependências:** `SECRET_GITHUB_TOKEN`.
- **Jobs:** `stale` (actions/stale com mensagens em português, labels `no-issue-activity`/`no-pr-activity`).
- **Observações:** fecha itens após 7 dias se não houver atividade pós-label.

| Trigger | Jobs | Duração | Notes |
| --- | --- | --- | --- |
| schedule diário | stale | Curta | Automatiza marcação/fechamento de itens inativos |

## Outros apontamentos
- Workflows ausentes do repositório no momento: `dependabot-updates.yml` e `copilot-pull-request-reviewer.yml` (mencionados na política, mas não versionados). Caso sejam adicionados, devem seguir este padrão de documentação.
- Todos os workflows utilizam cancelamento de concorrência quando aplicável e respeitam labels automáticas para guiar o fluxo de revisão/merge.
