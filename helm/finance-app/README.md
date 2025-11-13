s# Finance App Helm Chart

Este chart Helm gerencia o deploy completo da aplicação Finance App no Kubernetes.

## Estrutura

```
finance-app/
├── Chart.yaml              # Metadados do chart
├── values.yaml             # Valores padrão de configuração
├── templates/              # Templates Kubernetes
│   ├── _helpers.tpl       # Helpers reutilizáveis
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml           # HorizontalPodAutoscaler
│   ├── ingress.yaml
│   └── secrets.yaml       # Template de secrets (usar Sealed Secrets em prod)
└── values-*.yaml          # Values por ambiente
```

## Instalação

### Via Helm direto:

```bash
# Dev
helm install finance-app ./helm/finance-app \
  --namespace finance-app \
  --create-namespace \
  -f helm/finance-app/values-dev.yaml

# Prod
helm install finance-app ./helm/finance-app \
  --namespace finance-app \
  --create-namespace \
  -f helm/finance-app/values-prod.yaml
```

### Via ArgoCD:

O ArgoCD está configurado para gerenciar este chart automaticamente:

```bash
kubectl apply -f gitops/apps/finance-app/application.yaml
```

## Configuração

### Secrets

**⚠️ IMPORTANTE**: O arquivo `templates/secrets.yaml` é apenas um exemplo.

Em produção, use uma das seguintes abordagens:

1. **Sealed Secrets**:
```bash
kubectl create secret generic finance-app-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secrets.yaml
```

2. **External Secrets Operator**:
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: finance-app-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
  target:
    name: finance-app-secrets
  data:
    - secretKey: database-url
      remoteRef:
        key: finance-app/database-url
```

3. **AWS Secrets Manager** via IRSA (já configurado no Terraform).

### Values Customização

Principais valores configuráveis:

```yaml
# Imagens
backend.image.repository: "211125320014.dkr.ecr.us-east-1.amazonaws.com/finance-app"
backend.image.tag: "latest"

# Recursos
backend.resources.limits.cpu: "500m"
backend.resources.limits.memory: "512Mi"

# Autoscaling
autoscaling.enabled: true
autoscaling.minReplicas: 2
autoscaling.maxReplicas: 10

# Ingress
ingress.enabled: true
ingress.hosts[0].host: "finance.lab.example.com"
```

## Environments

### Development (`values-dev.yaml`)
- Replicas: 1-2
- Recursos reduzidos
- Sem TLS

### Production (`values-prod.yaml`)
- Replicas: 3-10
- Recursos completos
- TLS habilitado
- PodDisruptionBudget

## Health Checks

### Backend
- **Liveness**: `GET /health` (porta 3000)
- **Readiness**: `GET /health` (porta 3000)

### Frontend
- Servido por nginx, sem health checks específicos

## Monitoramento

O chart inclui annotations para Prometheus:
```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"
```

## Upgrade

```bash
helm upgrade finance-app ./helm/finance-app \
  --namespace finance-app \
  -f helm/finance-app/values-prod.yaml
```

## Rollback

```bash
# Ver histórico
helm history finance-app -n finance-app

# Rollback para revisão anterior
helm rollback finance-app -n finance-app

# Rollback para revisão específica
helm rollback finance-app 3 -n finance-app
```
