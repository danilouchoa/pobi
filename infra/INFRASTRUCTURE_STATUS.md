# Infraestrutura EKS - Status e Próximos Passos

## ✅ O que já está criado (no Terraform State)

### VPC e Networking
- ✅ VPC: `vpc-0a6b48f932bf0315e` (10.140.0.0/16)
- ✅ Internet Gateway: `igw-083cc083c94f03796`
- ✅ NAT Gateway: `eipalloc-05d172c047c10a73d` (98.95.56.210)
- ✅ Subnets Públicas:
  - `subnet-0a7aa7eb971e0d203` (us-east-1a)
  - `subnet-009d998fe63716ce7` (us-east-1b)
- ✅ Subnets Privadas:
  - `subnet-03b60a2f143276a1f` (us-east-1a)
  - `subnet-0a684526620021d1e` (us-east-1b)
- ✅ Route Tables configuradas

### ECR
- ✅ Repository: `211125320014.dkr.ecr.us-east-1.amazonaws.com/finance-app`

### Recursos Importados
- ✅ KMS Alias: `alias/eks/oraex-lab-eks`
- ✅ CloudWatch Log Group: `/aws/eks/oraex-lab-eks/cluster`

## 🔄 Em andamento (Terraform Apply)

### EKS Cluster
- ⏳ Cluster: `oraex-lab-eks` (v1.34)
- ⏳ IAM Roles para cluster e nodes
- ⏳ Security Groups
- ⏳ OIDC Provider (para IRSA)

### Node Group - Spot Instances
- ⏳ **12 tipos de instâncias ARM64** para melhor disponibilidade:
  - T4g: medium, large
  - M7g: medium, large
  - M7g-flex: medium, large
  - M6g: medium, large
  - C7g: medium, large
  - C6g: medium, large
- ⏳ Min: 2, Desired: 3, Max: 6 nodes
- ⏳ 100% Spot (economia de até 70%)

### AWS Managed Addons
- ⏳ vpc-cni
- ⏳ coredns
- ⏳ kube-proxy
- ⏳ aws-ebs-csi-driver

### IRSA (IAM Roles for Service Accounts)
- ⏳ Cluster Autoscaler
- ⏳ AWS Load Balancer Controller
- ⏳ EBS CSI Driver

## 📋 Tempo Estimado de Criação

| Recurso | Tempo Estimado |
|---------|---------------|
| VPC + Subnets | ✅ 2-3 min (concluído) |
| NAT Gateway | ✅ 2-3 min (concluído) |
| **EKS Cluster** | ⏳ **10-15 min** |
| **Node Group** | ⏳ **5-10 min** |
| Addons | ⏳ 2-5 min |
| **Total** | **~25-35 min** |

## 🎯 Próximos Passos Após Terraform Apply

### 1. Configurar kubectl
```bash
aws eks update-kubeconfig --name oraex-lab-eks --region us-east-1
kubectl get nodes
kubectl get pods -A
```

### 2. Verificar Addons
```bash
kubectl get pods -n kube-system
# Deve mostrar:
# - coredns
# - kube-proxy
# - aws-node (vpc-cni)
# - ebs-csi-controller
```

### 3. Instalar Componentes de Platform (ArgoCD)

#### Opção A: Via Helm direto
```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

#### Opção B: Via GitOps (recomendado)
```bash
# 1. Install ArgoCD manualmente primeiro
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. Apply App of Apps
kubectl apply -f gitops/root/app-of-apps.yaml

# 3. Tudo mais será instalado automaticamente:
# - Metrics Server
# - Prometheus + Grafana
# - Argo Rollouts
# - Istio
# - Finance App
```

### 4. Deploy Finance App

#### Via ArgoCD UI:
1. Acessar ArgoCD UI
2. Ver finance-app Application
3. Click em "Sync"

#### Via CLI:
```bash
argocd app sync finance-app
```

#### Via GitOps (automático):
- Basta fazer push para o repositório
- ArgoCD detecta e aplica automaticamente

## 🔐 Secrets Necessárias

Antes de deployar o finance-app, criar secrets:

```bash
kubectl create namespace finance-app

kubectl create secret generic finance-app-secrets \
  --namespace finance-app \
  --from-literal=database-url="postgresql://user:pass@host:5432/db" \
  --from-literal=jwt-secret="your-jwt-secret" \
  --from-literal=google-client-id="your-google-client-id" \
  --from-literal=google-client-secret="your-google-client-secret"
```

Ou usar **Sealed Secrets** (recomendado para produção).

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

Criar `.github/workflows/deploy.yaml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'frontend/**'

jobs:
  build-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to ECR
        run: |
          aws ecr get-login-password --region us-east-1 | \
          docker login --username AWS --password-stdin 211125320014.dkr.ecr.us-east-1.amazonaws.com
      
      - name: Build and Push Backend
        run: |
          cd backend
          docker build -t 211125320014.dkr.ecr.us-east-1.amazonaws.com/finance-app:${{ github.sha }} .
          docker push 211125320014.dkr.ecr.us-east-1.amazonaws.com/finance-app:${{ github.sha }}
      
      - name: Update ArgoCD Application
        run: |
          # Update image tag in gitops/root/finance-app.yaml
          sed -i "s|value: \".*\"|value: \"${{ github.sha }}\"|" gitops/root/finance-app.yaml
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add gitops/root/finance-app.yaml
          git commit -m "chore: update finance-app image to ${{ github.sha }}"
          git push
```

## 📊 Monitoramento

### Terraform Outputs
```bash
cd ~/pobi/infra/terraform/envs/dev
terraform output
```

### Cluster Status
```bash
# Nodes
kubectl get nodes -o wide

# Workloads
kubectl get pods -A

# Services
kubectl get svc -A

# Ingress/Routes
kubectl get ingress -A
```

### Costs
```bash
# Ver custos Spot vs On-Demand
aws ec2 describe-spot-instance-requests --region us-east-1
```

## 🐛 Troubleshooting

### Nodes não sobem:
```bash
# Ver eventos do node group
kubectl describe nodes

# Ver Auto Scaling Group
aws autoscaling describe-auto-scaling-groups \
  --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'oraex-lab-eks')]"
```

### Pods pending:
```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Terraform stuck:
```bash
# Ver recursos criados
terraform state list

# Ver logs detalhados
TF_LOG=DEBUG terraform apply
```

## 📚 Documentação Criada

- ✅ `DEPLOY_GUIDE.md` - Guia completo de deploy
- ✅ `SPOT_STRATEGY.md` - Estratégia de instâncias Spot
- ✅ `gitops/README.md` - Estrutura GitOps
- ✅ `helm/finance-app/README.md` - Helm chart documentation
- ✅ Este arquivo - Status e próximos passos

## 🎯 Checklist de Deploy Completo

- [ ] Terraform apply concluído
- [ ] kubectl configurado
- [ ] Nodes rodando (3 nodes)
- [ ] Addons instalados
- [ ] ArgoCD instalado
- [ ] Secrets criadas
- [ ] App of Apps aplicado
- [ ] Finance app deployado
- [ ] Ingress configurado
- [ ] DNS apontado
- [ ] TLS configurado
- [ ] Monitoramento ativo
- [ ] CI/CD pipeline configurado
