🚀 CI/CD (3 workflows ativos)
1. CI Backend (ci-backend.yml)

Trigger: Push/PR em main quando backend, infra, helm ou o próprio workflow mudam
Fluxo:
Detecta mudanças no backend (path filter)
Instala deps → Lint → Testes + Cobertura → Build TypeScript
Deploy automático (apenas em push para main):
Build de imagem Docker → Push para ECR
Login ArgoCD → Atualiza Helm values → Sync da aplicação
Smoke test (/api/health)
⚠️ Problema: Lint e testes têm fallback || echo (não bloqueiam CI em caso de falha)
2. CI Frontend (ci-frontend.yml)

Trigger: Push/PR em main quando frontend, infra, helm ou o workflow mudam
Fluxo:
Job separado para detectar mudanças
Instala deps → Lint → Testes → Build
Deploy automático (apenas em push para main):
Build imagem → Push ECR → ArgoCD sync
⚠️ Problema: Lint e testes também não bloqueiam (fallback com || echo)
3. CI Build Images (ci-build-images.yml) — COMENTADO/DESATIVADO

Build de backend + frontend com cache de Docker e push para ECR
Substituído pelos deploys individuais em ci-backend e ci-frontend
🔒 Segurança (2 workflows ativos)
4. CodeQL Security Analysis (codeql.yml)

Trigger: Push/PR para main, schedule semanal (domingos 21:33 UTC)
Analisa backend e frontend separadamente (TypeScript/JavaScript)
Queries: security-extended + security-and-quality
Foco: SQL injection, XSS, vazamento de secrets, vulnerabilidades de auth
5. Qodana Code Quality (qodana_code_quality.yml)

Trigger: Manual (workflow_dispatch) ou PR para main
Scanner JetBrains para qualidade de código
Envia resultados para Qodana Cloud
Escreve comentários em PRs com findings
🤖 Automação de Dependências (2 workflows ativos)
6. Dependabot Auto-Approve (dependabot-auto-merge.yml)

Trigger: PRs abertos/sincronizados pelo Dependabot
Apenas aprova PRs de deps automaticamente
Não faz merge automático (título antigo era enganoso)
7. Pull Request Labeler (labeler.yml)

Trigger: PRs abertos/sincronizados (exceto drafts)
Adiciona labels automaticamente baseado em arquivos modificados
Config em labeler.yml
🧹 Manutenção (2 workflows ativos)
8. Cache Cleanup (cache-cleanup.yml)

Trigger: Schedule semanal (domingos 03:00 UTC) ou manual
Mantém apenas os 5 caches mais recentes por prefixo
Evita acúmulo de caches obsoletos no GitHub
9. Mark Stale Issues/PRs (stale.yml)

Trigger: Schedule diário (09:00 UTC)
Marca issues/PRs inativos há 30 dias
Fecha automaticamente após 7 dias de inatividade
🚫 Workflows Desativados (4 comentados)
10. CD ArgoCD Sync (cd-argocd-sync.yml) — COMENTADO

Sincronização após CI Build Images
Substituído pelos deploys individuais
11. Deploy Dev (deploy-dev.yaml) — COMENTADO

Build + push + deploy via ArgoCD
Duplicado com ci-backend e ci-frontend
12. Label Ready (label-ready.yml) — (não li, mas provavelmente obsoleto)

13. README (README.md) — Documentação dos workflows

⚠️ Problemas Críticos Identificados
Lint e testes não bloqueiam CI — Código quebrado pode ir para produção

Backend: linhas 86, 94
Frontend: linhas 95, 103
Deploy ignora resultado dos testes — deploy-backend-dev roda mesmo se backend não mudou ou testes falharam

Permissões muito amplas — actions: write sem necessidade

Duplicação de workflows — 3 workflows de deploy comentados + 2 ativos fazendo o mesmo

💡 Recomendações
Remover || echo dos steps de lint/test
Adicionar gate no deploy: needs.build-test-backend.outputs.backend == 'true'
Reduzir permissões para actions: read
Deletar workflows comentados (ci-build-images.yml, cd-argocd-sync.yml, deploy-dev.yaml)
Considerar consolidar cache cleanup nos próprios workflows de CI