# GitOps Structure

Estrutura organizada do GitOps com ArgoCD usando o padrão **App of Apps**.

## 📁 Estrutura

```text
gitops/
├── root/                           # App of Apps - Orchestrator principal
│   ├── app-of-apps.yaml           # ArgoCD Application que gerencia os apps de platform
│   └── platform-apps.yaml         # Application dos apps de platform
│
├── backend-app.yaml               # Application Helm para o backend (helm/backend)
├── frontend-app.yaml              # Application Helm para o frontend (helm/frontend)
└── apps/                           # Aplicações gerenciadas
  └── platform/                   # Platform apps (infra base)
    ├── kustomization.yaml      # Kustomize para platform apps
    ├── metrics-server/         # Metrics Server
    ├── kube-prometheus-stack/  # Prometheus + Grafana
    ├── argo-rollouts/          # Argo Rollouts (canary deployments)
    ├── istio-base/             # Istio Base
    ├── istiod/                 # Istio Control Plane
    ├── istio-ingress/          # Istio Ingress Gateway (via chart oficial)
    └── external-dns/           # ExternalDNS (Cloudflare)
```

## 🚀 Deploy Strategy

### 1. Bootstrap - App of Apps (Uma única vez)

Aplica o **App of Apps** que automaticamente gerencia todos os outros:

```bash
kubectl apply -f gitops/root/app-of-apps.yaml
```

Isto criará automaticamente:

- ✅ `platform-apps` Application (que deploya todos os apps de platform)

Os Applications do backend e frontend são independentes (top-level):

```bash
kubectl apply -f gitops/backend-app.yaml
kubectl apply -f gitops/frontend-app.yaml
```

### 2. Verificar Applications Criadas

```bash
# Ver todas as applications
kubectl get applications -n argocd

# Deve mostrar:
# NAME             SYNC STATUS   HEALTH STATUS
# root-apps        Synced        Healthy
# platform-apps    Synced        Healthy
# finfy-backend    Synced        Healthy
# finfy-frontend   Synced        Healthy
# metrics-server   Synced        Healthy
# ... etc
```

### 3. Acessar ArgoCD UI

```bash
# Port-forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Abrir no browser
# https://localhost:8080

# Obter senha admin
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## 📦 Applications

### Root Apps (Orchestrator)

#### `app-of-apps.yaml`
- **Propósito**: App of Apps principal - gerencia todos os outros
- **Path**: `gitops/root/`
- **Aplica**: `finance-app.yaml` e `platform-apps.yaml`

### Application Apps

#### `backend-app.yaml`
- Tipo: Helm Chart
- Path: `helm/backend`
- Namespace: `finfy`
- Auto-sync: ✅ Enabled
- Self-heal: ✅ Enabled

#### `frontend-app.yaml`
- Tipo: Helm Chart
- Path: `helm/frontend`
- Namespace: `finfy`
- Auto-sync: ✅ Enabled
- Self-heal: ✅ Enabled

#### `platform-apps.yaml`
- **Tipo**: Kustomize
- **Path**: `gitops/apps/platform`
- **Namespace**: `argocd`
- **Gerencia**: Todos os apps de infraestrutura (Istio, Prometheus, etc)
- **Auto-sync**: ✅ Enabled

## 🔄 Workflow de Deploy

### Para backend e frontend

1. Alterar código → Push para GitHub
2. CI/CD (GitHub Actions) → Build & Push para ECR e atualiza `image.tag` via ArgoCD sync workflow
3. ArgoCD detecta a mudança e aplica automaticamente nos Applications `finfy-backend` e `finfy-frontend`

### Para Platform Apps

1. **Modificar values** em `gitops/apps/platform/<app>/values.yaml`
2. **Commit + Push** → ArgoCD detecta e aplica

## 🎯 Benefícios desta Estrutura

### ✅ Single Entry Point
- Um único `kubectl apply -f gitops/root/app-of-apps.yaml` gerencia tudo

### ✅ GitOps Completo
- Todo deploy via Git
- Histórico completo de mudanças
- Rollback fácil (git revert)

### ✅ Separação de Responsabilidades
- **root/**: Orchestration (App of Apps)
- **apps/platform/**: Infrastructure apps
- **helm/**: Application charts (finance-app)

### ✅ Auto-sync & Self-heal
- Mudanças no Git → Deploy automático
- Drift detection → Correção automática

## 🔧 Comandos Úteis

### Ver status de todas as apps
```bash
argocd app list
```

### Forçar sync de uma app:
```bash
argocd app sync finfy-backend
argocd app sync finfy-frontend
argocd app sync platform-apps
```

### Ver diff antes de aplicar:
```bash
argocd app diff finfy-backend
argocd app diff finfy-frontend
```

### Rollback:
```bash
# Via Git (recomendado)
git revert <commit-hash>
git push

# Via ArgoCD (emergência)
argocd app rollback finance-app <revision>
```

### Deletar tudo (cleanup):
```bash
kubectl delete application root-apps -n argocd
# Isso cascateia e remove todas as apps gerenciadas
```

## 📋 Ordem de Deploy (Bootstrap)

Se precisar fazer bootstrap manual:

```bash
# 1. Platform apps primeiro (infra base)
kubectl apply -f gitops/root/platform-apps.yaml

# 2. Aguardar platform apps ficarem healthy
kubectl wait --for=condition=Ready pods -l app.kubernetes.io/name=metrics-server -n kube-system --timeout=300s

# 3. Deploy applications do produto
kubectl apply -f gitops/backend-app.yaml
kubectl apply -f gitops/frontend-app.yaml

# OU simplesmente:
# 1. App of Apps (faz tudo automaticamente)
kubectl apply -f gitops/root/app-of-apps.yaml
```

## 🔐 Secrets Management

As secrets do finance-app devem ser criadas antes do deploy:

```bash
# Opção 1: Sealed Secrets (recomendado)
kubectl create secret generic finance-app-secrets \
  --namespace finance-app \
  --from-literal=database-url="..." \
  --from-literal=jwt-secret="..." \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Opção 2: Manual (dev/test)
kubectl create secret generic finance-app-secrets \
  --namespace finance-app \
  --from-literal=database-url="..." \
  --from-literal=jwt-secret="..."
```

## 🎨 Customização por Ambiente

### Development:
```yaml
# gitops/root/finance-app.yaml
helm:
  valueFiles:
    - values.yaml
    - values-dev.yaml
```

### Production:
```yaml
# gitops/root/finance-app.yaml
helm:
  valueFiles:
    - values.yaml
    - values-prod.yaml
```

### Production + Canary:
```yaml
# gitops/root/finance-app.yaml
helm:
  valueFiles:
    - values.yaml
    - values-prod-rollout.yaml
```
