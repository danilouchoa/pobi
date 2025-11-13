# Guia de Deploy - Finance App

## 📁 Estrutura Criada

```
helm/finance-app/
├── Chart.yaml                    # Metadados do Helm chart
├── values.yaml                   # Valores padrão (deployment simples)
├── values-dev.yaml              # Configuração de desenvolvimento
├── values-prod.yaml             # Configuração de produção (sem rollout)
├── values-prod-rollout.yaml     # Configuração de produção com Argo Rollouts
├── README.md                    # Documentação do chart
├── .helmignore                  # Arquivos ignorados pelo Helm
└── templates/
    ├── _helpers.tpl             # Helpers reutilizáveis
    ├── backend-deployment.yaml  # Deployment tradicional do backend
    ├── backend-rollout.yaml     # Argo Rollout para canary deployment
    ├── backend-service.yaml     # Service simples do backend
    ├── backend-services-canary.yaml  # Services stable + canary
    ├── frontend-deployment.yaml # Deployment do frontend
    ├── frontend-service.yaml    # Service do frontend
    ├── serviceaccount.yaml      # ServiceAccount para IRSA
    ├── hpa.yaml                 # HorizontalPodAutoscaler
    ├── ingress.yaml             # Ingress/ALB configuration
    ├── analysis-template.yaml   # Métricas para análise do Rollout
    └── secrets.yaml             # Template de secrets (exemplo)
```

## 🚀 Como Usar

### Opção 1: Deploy Direto com Helm

#### Development:
```bash
helm install finance-app ./helm/finance-app \
  --namespace finance-app \
  --create-namespace \
  -f helm/finance-app/values-dev.yaml
```

#### Production (sem canary):
```bash
helm install finance-app ./helm/finance-app \
  --namespace finance-app \
  --create-namespace \
  -f helm/finance-app/values-prod.yaml
```

#### Production (com Argo Rollouts - canary):
```bash
helm install finance-app ./helm/finance-app \
  --namespace finance-app \
  --create-namespace \
  -f helm/finance-app/values-prod-rollout.yaml
```

### Opção 2: Deploy via ArgoCD (Recomendado)

#### 1. Aplicar o ArgoCD Application:
```bash
kubectl apply -f gitops/apps/finance-app/application.yaml
```

ou usar o App of Apps:
```bash
kubectl apply -f gitops/root/app-of-apps.yaml
```

#### 2. Verificar status:
```bash
# Via kubectl
kubectl get application finance-app -n argocd

# Via ArgoCD CLI
argocd app get finance-app

# Via UI
# Acesse: https://argocd.your-domain.com
```

#### 3. Forçar sync (se necessário):
```bash
argocd app sync finance-app
```

## 🎯 Modos de Deploy

### Modo 1: Deployment Tradicional
- **Arquivo**: `values.yaml` ou `values-dev.yaml` ou `values-prod.yaml`
- **Rollout**: `enabled: false`
- **Usa**: Deployment + Service + HPA
- **Quando usar**: Desenvolvimento, testes, ambientes sem requisitos de canary

### Modo 2: Argo Rollouts (Canary)
- **Arquivo**: `values-prod-rollout.yaml`
- **Rollout**: `enabled: true`
- **Usa**: Rollout + Service Stable + Service Canary + AnalysisTemplate
- **Quando usar**: Produção, quando precisa de progressive delivery

**Estratégia Canary:**
1. Deploy inicial com 20% do tráfego → pausa 2min
2. Análise automática (success rate + response time)
3. Se OK, aumenta para 50% → pausa 5min
4. Análise final
5. Se tudo OK, promove para 100%

## 🔐 Configuração de Secrets

**⚠️ IMPORTANTE**: O arquivo `templates/secrets.yaml` é apenas exemplo!

### Em Produção, use uma destas opções:

#### Opção A: Sealed Secrets
```bash
kubectl create secret generic finance-app-secrets \
  --namespace finance-app \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=google-client-id="..." \
  --from-literal=google-client-secret="..." \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

kubectl apply -f sealed-secret.yaml
```

#### Opção B: External Secrets (AWS Secrets Manager)
Já configurado no Terraform com IRSA!

```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: finance-app-secrets
  namespace: finance-app
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: finance-app-secrets
  data:
    - secretKey: database-url
      remoteRef:
        key: finance-app/prod/database-url
    - secretKey: jwt-secret
      remoteRef:
        key: finance-app/prod/jwt-secret
```

#### Opção C: Criar manualmente
```bash
kubectl create secret generic finance-app-secrets \
  --namespace finance-app \
  --from-literal=database-url="..." \
  --from-literal=jwt-secret="..." \
  --from-literal=google-client-id="..." \
  --from-literal=google-client-secret="..."
```

## 📊 Monitoramento do Rollout

### Ver status do Rollout:
```bash
kubectl argo rollouts get rollout finance-app-backend -n finance-app
```

### Acompanhar progresso em tempo real:
```bash
kubectl argo rollouts get rollout finance-app-backend -n finance-app --watch
```

### Promover manualmente (pular análise):
```bash
kubectl argo rollouts promote finance-app-backend -n finance-app
```

### Abortar rollout (rollback):
```bash
kubectl argo rollouts abort finance-app-backend -n finance-app
```

### Ver análises executadas:
```bash
kubectl get analysisrun -n finance-app
kubectl describe analysisrun <name> -n finance-app
```

## 🔄 Atualizando a Aplicação

### Via Helm:
```bash
# Atualizar imagem do backend
helm upgrade finance-app ./helm/finance-app \
  --namespace finance-app \
  -f helm/finance-app/values-prod-rollout.yaml \
  --set backend.image.tag=v1.2.3

# Atualizar ambos
helm upgrade finance-app ./helm/finance-app \
  --namespace finance-app \
  -f helm/finance-app/values-prod-rollout.yaml \
  --set backend.image.tag=v1.2.3 \
  --set frontend.image.tag=v1.2.3
```

### Via ArgoCD (GitOps - Recomendado):
1. Atualizar tag no `gitops/apps/finance-app/application.yaml`:
   ```yaml
   helm:
     parameters:
       - name: backend.image.tag
         value: "v1.2.3"
   ```

2. Commit e push:
   ```bash
   git add gitops/apps/finance-app/application.yaml
   git commit -m "chore: update finance-app to v1.2.3"
   git push
   ```

3. ArgoCD detecta e aplica automaticamente (ou force sync)

### Via GitHub Actions (CI/CD):
O workflow em `.github/workflows/deploy.yaml` já faz isso automaticamente quando você:
- Faz push para `main` → deploy automático

## 🧪 Testando Localmente

### Renderizar templates sem aplicar:
```bash
helm template finance-app ./helm/finance-app \
  -f helm/finance-app/values-prod-rollout.yaml
```

### Validar chart:
```bash
helm lint ./helm/finance-app
```

### Dry-run:
```bash
helm install finance-app ./helm/finance-app \
  --dry-run \
  --debug \
  -f helm/finance-app/values-prod-rollout.yaml
```

## 📝 Variáveis de Ambiente Importantes

### Backend
- `DATABASE_URL` - Connection string do PostgreSQL
- `JWT_SECRET` - Secret para assinatura de JWTs
- `GOOGLE_CLIENT_ID` - OAuth Google
- `GOOGLE_CLIENT_SECRET` - OAuth Google secret
- `NODE_ENV` - production
- `PORT` - 3000

### Frontend
- `VITE_API_URL` - URL do backend (`http://backend:3000` interno)
- `VITE_GOOGLE_CLIENT_ID` - OAuth Google client ID

## 🎛️ Configurações por Ambiente

| Configuração | Dev | Prod | Prod + Rollout |
|--------------|-----|------|----------------|
| Replicas | 1 | 3 | 3 |
| CPU Limit | 300m | 1000m | 1000m |
| Memory Limit | 384Mi | 1Gi | 1Gi |
| HPA | ❌ | ✅ | ❌ |
| Argo Rollout | ❌ | ❌ | ✅ |
| TLS/HTTPS | ❌ | ✅ | ✅ |
| Image Pull | Always | IfNotPresent | IfNotPresent |

## 🚨 Troubleshooting

### Pods não sobem:
```bash
kubectl get pods -n finance-app
kubectl describe pod <pod-name> -n finance-app
kubectl logs <pod-name> -n finance-app
```

### Rollout travado:
```bash
kubectl argo rollouts get rollout finance-app-backend -n finance-app
kubectl argo rollouts abort finance-app-backend -n finance-app  # Abortar
```

### ArgoCD out of sync:
```bash
argocd app diff finance-app
argocd app sync finance-app --force
```

### Secrets não encontrados:
```bash
kubectl get secrets -n finance-app
kubectl describe secret finance-app-secrets -n finance-app
```

## 📚 Próximos Passos

1. ✅ Estrutura Helm criada
2. ✅ ArgoCD Application configurado
3. ⏳ Criar secrets em produção (AWS Secrets Manager ou Sealed Secrets)
4. ⏳ Configurar CI/CD (GitHub Actions) para build e push de imagens
5. ⏳ Testar deploy completo no cluster
6. ⏳ Configurar domínio e TLS
7. ⏳ Testar canary deployment com Argo Rollouts
