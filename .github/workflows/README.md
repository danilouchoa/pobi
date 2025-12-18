# Workflows GitHub Actions

Documentação dos pipelines ativos do repositório. Labels automáticas (`labeler.yml`) classificam PRs por escopo e o `label-ready.yml` aplica `Ready to Merge` somente após os checks críticos `build-test-backend` e `build-test-frontend` concluírem com sucesso.

## Visão Geral
- Branch protegida: `main` exige CI verde (backend/frontend) e validações adicionais conforme política de segurança.
- Concurrency: todos os fluxos de CI/SAST usam cancelamento de execuções concorrentes por branch/commit.
- Cache: npm/Vite/ Docker layer caches persistidos com retenção curta e rotina de limpeza (`cache-cleanup.yml`).
- Segurança: uso de OIDC para AWS/ECR, tokens mínimos necessários e mascaramento de segredos.

## Workflows

### ci-frontend.yml — CI Frontend
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Lint, build e testes/cobertura do frontend; publicar imagem e sincronizar ArgoCD na `main`. |
| Gatilhos | `push` e `pull_request` em `main` com paths `frontend/**`, `infra/**`, `helm/**`, `.github/workflows/ci-frontend.yml`. |
| Quando roda/não roda | Executa apenas se houver alterações nos paths monitorados; deploy só em `push` para `main`. PRs sem mudanças nesses caminhos não disparam. |
| Jobs | `build-test-frontend` (npm ci, lint, build, Vitest/coverage, artifact de cobertura); `deploy-frontend-dev` (build/push imagem para ECR, atualizar Helm via ArgoCD, smoke test `/login`); `prune-caches-frontend` (limpeza de caches). |
| Restrições de branch | CI em `main`; deploy gated por `github.ref == refs/heads/main`. |
| Regras de aprovação | Check `build-test-frontend` requerido por `label-ready.yml` para liberar `Ready to Merge`. |
| Observações | Cache compartilhado com retenção de 7 dias; fallback de `VITE_GOOGLE_CLIENT_ID`; concorrência por branch; depende de AWS/ArgoCD. |
| Relação com labels | Garante check verde consumido por `label-ready.yml`; labels de escopo via `labeler.yml` não influenciam a execução. |

### ci-backend.yml — CI Backend
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Lint, `tsc --noEmit`, testes/cobertura do backend; build/push de imagem e sync ArgoCD na `main`. |
| Gatilhos | `push` e `pull_request` em `main` com paths `backend/**`, `infra/**`, `helm/**`, `.github/workflows/ci-backend.yml`. |
| Quando roda/não roda | Apenas quando há mudanças nos paths monitorados; deploy exclusivo para `push` na `main`. |
| Jobs | `build-test-backend` (npm ci, lint, TypeScript, Vitest/coverage, artifact); `deploy-backend-dev` (build/push imagem para ECR, atualizar Helm via ArgoCD, smoke test `/api/health`); `prune-caches-backend`. |
| Restrições de branch | CI em `main`; deploy bloqueado para outros branches. |
| Regras de aprovação | `build-test-backend` é check requerido para `Ready to Merge`. |
| Observações | Envs fallback para OAuth/CORS em PRs; concorrência por branch; cache npm/Vite com retenção curta. |
| Relação com labels | Resultado usado pelo `label-ready.yml`; labels automáticas não bloqueiam execução. |

### ci-build-images.yml — Build de Imagens
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Build e push das imagens Docker do backend e frontend para ECR com tags `latest` e SHA curto; exporta artifact `image-tags`. |
| Gatilhos | `push` na `main` com alterações em backend/frontend/docker-compose/helm/infra ou no próprio workflow. |
| Quando roda/não roda | Apenas em `main` e somente se paths relevantes forem alterados. |
| Jobs | `build-and-push` (build com cache GHA, push para ECR, gera artifact `image-tags`, prune caches). |
| Restrições de branch | Somente `main`. |
| Regras de aprovação | Não é check obrigatório para merge; alimenta CD. |
| Observações | Usa OIDC para AWS; cache GHA por escopo; artifact consumido por `cd-argocd-sync.yml`. |
| Relação com labels | Independente de labels, mas facilita merges de PRs de release ao prover imagens atuais. |

### cd-argocd-sync.yml — Sync pós-build
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Aplicar tags de imagem geradas pelo CI de build nas aplicações ArgoCD (backend/front). |
| Gatilhos | `workflow_run` concluído de "CI Build Images" com conclusão `success`. |
| Quando roda/não roda | Só executa se o workflow anterior terminar com sucesso; não roda em execuções falhas ou canceladas. |
| Jobs | `sync` (baixar `image-tags`, autenticar no ArgoCD via token SSO, aplicar `helm-set` de tags e sincronizar/aguardar apps). |
| Restrições de branch | Herdadas do gatilho (apenas builds da `main`). |
| Regras de aprovação | Não requerido para merge; integra fluxo de CD. |
| Observações | Usa `workflow_run`, evitando rebuilds; depende de `ARGOCD_AUTH_TOKEN`. |
| Relação com labels | Não aplica labels; mantém ambiente atualizado para PRs já aprovados. |

### deploy-dev.yaml — Deploy Dev direto
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Pipeline de deploy contínuo para ambiente dev (build/push de imagens e sync ArgoCD) disparado diretamente pela branch protegida. |
| Gatilhos | `push` para `main` (sem filtro de paths). |
| Quando roda/não roda | Sempre que há push na `main`; não executa em PRs. |
| Jobs | `build-and-push` (Docker build/push backend e frontend, tags SHA, outputs); `deploy-argocd` (login ArgoCD, `helm-set` de repos/tag, sync/wait, smoke tests). |
| Restrições de branch | Exclusivo para `main`. |
| Regras de aprovação | Não atua em PRs; depende de proteção da `main`. |
| Observações | Usa environment `dev`; OIDC para AWS; smoke tests de UI e API. |
| Relação com labels | Fora do fluxo de labels; mantém ambiente dev alinhado com `main`. |

### codeql.yml — CodeQL Security Analysis
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | SAST (security-extended + security-and-quality) para backend e frontend. |
| Gatilhos | `push`/`pull_request` em `main` (opened/synchronize/reopened/ready_for_review) com paths backend/frontend/workflow; `schedule` semanal (domingo 21:33 UTC). |
| Quando roda/não roda | Não executa se PR não tocar paths monitorados; agenda roda sempre. |
| Jobs | `analyze` (matriz backend/frontend, Node 20, init/analyze CodeQL com paths-ignore). |
| Restrições de branch | Monitoramento focado na `main`. |
| Regras de aprovação | Job `analyze` monitorado por `label-ready.yml`, mas não é marcado como required check adicional. |
| Observações | Timeout 360 min; usa cache npm; cancela execuções concorrentes. |
| Relação com labels | Eventos `workflow_run` alimentam `label-ready.yml` para checar conclusão antes de aplicar `Ready to Merge`. |

### qodana_code_quality.yml — Qodana
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Análise estática Qodana Cloud para backend e frontend. |
| Gatilhos | `pull_request` em `main` (opened/synchronize/reopened/ready_for_review) com paths monitorados; `workflow_dispatch` manual. |
| Quando roda/não roda | Não roda em PR draft; só dispara se paths incluídos forem alterados ou via execução manual. |
| Jobs | `qodana` (checkout na ref do PR, scan cloud, publicação de comentários/checks). |
| Restrições de branch | Focado em PRs contra `main`. |
| Regras de aprovação | Não bloqueia merge por padrão; resultados exibidos em checks. |
| Observações | Requer `QODANA_TOKEN_739358186`; permissões de escrita em checks/PR. |
| Relação com labels | Complementa revisão; labels não alteram execução. |

### dependabot-auto-merge.yml — Auto-approve Dependabot
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Aprovar automaticamente PRs gerados pelo Dependabot (sem auto-merge). |
| Gatilhos | `pull_request_target` (opened/synchronize/reopened). |
| Quando roda/não roda | Só executa quando `github.actor == dependabot[bot]`; não roda em PRs de humanos. |
| Jobs | `approve` (checkout, `dependabot/fetch-metadata`, aprovação automática). |
| Restrições de branch | Depende do branch alvo do Dependabot (padrão `main`). |
| Regras de aprovação | Apenas registra aprovação; merge continua condicionado aos checks/labels usuais. |
| Observações | Usa `SECRET_GITHUB_TOKEN`; não realiza merge automático. |
| Relação com labels | PRs recebem labels de dependência via configuração do Dependabot; `labeler.yml` pode complementar. |

### labeler.yml — Pull Request Labeler
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Aplicar labels conforme `.github/labeler.yml` para classificar PRs. |
| Gatilhos | `pull_request` (opened/synchronize/reopened/ready_for_review). |
| Quando roda/não roda | Ignora PRs em rascunho (`draft == true`). |
| Jobs | `labeler` (actions/labeler com `sync-labels: false`). |
| Restrições de branch | Nenhuma específica além do PR aberto. |
| Regras de aprovação | Não bloqueia merge; fornece metadados para revisão. |
| Observações | Usa `SECRET_GITHUB_TOKEN`; não remove labels manualmente ajustadas. |
| Relação com labels | É o gerador principal de labels de escopo consumidos por revisores e automações. |

### label-ready.yml — Label Ready to Merge
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Aplicar label `Ready to Merge` quando checks obrigatórios estiverem verdes. |
| Gatilhos | `workflow_run` (completed) dos workflows CI Backend, CI Frontend e CodeQL Security Analysis. |
| Quando roda/não roda | Apenas para eventos originados de `pull_request`; ignora execuções sem PR associado ou com checks pendentes/falhos. |
| Jobs | `label-ready` (localiza PR pelo SHA/branch, verifica check runs `build-test-backend` e `build-test-frontend`, aplica label se `success`). |
| Restrições de branch | Segue branches dos workflows de origem (principalmente `main`). |
| Regras de aprovação | Atua como gate de merge ao adicionar `Ready to Merge` somente com CI verde. |
| Observações | Evita duplicar label; não força remoção se checks falham após aplicação. |
| Relação com labels | Usa labels existentes e adiciona `Ready to Merge`; depende indiretamente do `labeler.yml` para contexto do PR. |

### cache-cleanup.yml — Limpeza de caches
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Remover caches antigos do GitHub Actions, mantendo no máximo 5 por prefixo. |
| Gatilhos | `schedule` semanal (domingo 03:00 UTC) e `workflow_dispatch`. |
| Quando roda/não roda | Sempre nas janelas agendadas ou quando acionado manualmente; independente de alterações de código. |
| Jobs | `prune-caches` (percorre caches e deleta excedentes). |
| Restrições de branch | Não se aplica; atua no repositório inteiro. |
| Regras de aprovação | Não é check requerido. |
| Observações | Minimiza storage e falhas por cache corrompido. |
| Relação com labels | Nenhuma interação. |

### stale.yml — Stale Issues/PRs
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Sinalizar e fechar issues/PRs inativos. |
| Gatilhos | `schedule` diário (09:00 UTC). |
| Quando roda/não roda | Executa diariamente; não depende de alterações. |
| Jobs | `stale` (actions/stale, aplica labels `no-issue-activity`/`no-pr-activity`, fecha após 7 dias). |
| Restrições de branch | Não aplicável. |
| Regras de aprovação | Não impacta merge; organiza backlog. |
| Observações | Usa `SECRET_GITHUB_TOKEN`; mensagens em português. |
| Relação com labels | Gera labels de inatividade visíveis no triage. |

### Dependabot — Updates semanais
| Aspecto | Detalhes |
| --- | --- |
| Objetivo | Gerar PRs automáticos de atualização de dependências para backend e frontend. |
| Gatilhos | Configuração em `.github/dependabot.yml`: `schedule` semanal (domingo 14:02 America/Sao_Paulo) para `npm` em `/backend` e `/frontend`. |
| Quando roda/não roda | Executado pelo serviço Dependabot, independentemente de workflows; limitado a `main`. |
| Jobs | Serviço nativo (não há workflow dedicado). |
| Restrições de branch | PRs direcionados à `main`. |
| Regras de aprovação | PRs recebem labels `dependencies` e `auto-update`; podem ser aprovados automaticamente pelo workflow `dependabot-auto-merge.yml`. |
| Observações | Limite de 10 PRs abertos por diretório. |
| Relação com labels | Labels automáticos auxiliam revisão e automações de merge. |

## Referências
- Configuração de updates: `.github/dependabot.yml`.
- Labeling automático: `.github/labeler.yml`.
- Políticas de proteção de branch: ver configurações do repositório (checks requeridos: `build-test-backend`, `build-test-frontend`).
- CD ArgoCD e imagens: `ci-build-images.yml`, `cd-argocd-sync.yml`, `deploy-dev.yaml`.
