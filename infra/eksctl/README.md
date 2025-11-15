# lab-eks via eksctl

Infraestrutura mínima para o cluster privado/público de laboratório `lab-eks` na conta oraex-lab.

## Estrutura

```
infra/eksctl/
├── cluster.yaml                       # definição principal do cluster eksctl
├── README.md                          # este guia passo-a-passo
└── addons/
    ├── aws-load-balancer-controller-values.yaml
    ├── cluster-autoscaler-values.yaml
    └── metrics-server-values.yaml
```

## Pré-requisitos

- `eksctl` ≥ 0.178.0 (suporte a k8s 1.34)
- `kubectl` ≥ 1.30
- `helm` ≥ 3.12
- `aws` CLI configurado com profile `oraex-lab`
- Subnets/VPC já existentes:
  - VPC `vpc-0758d3d3c37d3dfe0`
  - Subnets privadas `subnet-0b56a33f2355ff548`, `subnet-06a7870888cb55ab6`
  - Subnets públicas `subnet-0c8afb96c5f7b501c`, `subnet-05f3d80590f621724`
- NAT Gateway operacional e route tables apontando para ele
- Tags padrão: `Environment=lab`, `shutdown=true`

## Passos

1. **Ajustar placeholders**
   - Substitua `<ACCOUNT_ID>` e o ARN da role administrador (linha `AdministratorSSO`) em `cluster.yaml`.
   - Atualize as anotações de IAM (`eks.amazonaws.com/role-arn`) nos arquivos de values para o ARN real das roles.

2. **Criar/atualizar tags das subnets** (caso não existam):

   ```bash
   aws ec2 create-tags --profile oraex-lab --region us-east-1 \
     --resources subnet-0c8afb96c5f7b501c subnet-05f3d80590f621724 \
     --tags Key=kubernetes.io/cluster/lab-eks,Value=shared Key=kubernetes.io/role/elb,Value=1

   aws ec2 create-tags --profile oraex-lab --region us-east-1 \
     --resources subnet-0b56a33f2355ff548 subnet-06a7870888cb55ab6 \
     --tags Key=kubernetes.io/cluster/lab-eks,Value=shared Key=kubernetes.io/role/internal-elb,Value=1
   ```

3. **Criar roles IAM para add-ons** (AutoScaler & ALB Controller). Exemplo: usar `eksctl create iamserviceaccount` ou Terraform.

4. **Provisionar cluster**

   ```bash
   eksctl create cluster -f infra/eksctl/cluster.yaml
   aws eks update-kubeconfig --name lab-eks --region us-east-1 --alias lab-eks
   kubectl get nodes
   ```

5. **Instalar add-ons via Helm**

   ```bash
   helm repo add eks https://aws.github.io/eks-charts
   helm repo add autoscaler https://kubernetes.github.io/autoscaler
   helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
   helm repo update

   helm upgrade --install metrics-server metrics-server/metrics-server \
     --namespace kube-system --create-namespace \
     -f infra/eksctl/addons/metrics-server-values.yaml

   helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
     --namespace kube-system \
     -f infra/eksctl/addons/cluster-autoscaler-values.yaml

   helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
     --namespace kube-system \
     -f infra/eksctl/addons/aws-load-balancer-controller-values.yaml
   ```

6. **Ingress & DNS**
   - Criar certificado ACM em `us-east-1` para `*.finfy.me` ou host específico.
   - Criar manifesto ingress usando `kubernetes.io/ingress.class: alb`.
   - Apontar CNAME no Cloudflare para o DNS do ALB.

7. **Economia no lab**
   - Para desligar temporariamente:
     ```bash
     eksctl scale nodegroup --cluster lab-eks --name spot-arm --nodes 0
     ```
   - Para destruir tudo:
     ```bash
     eksctl delete cluster -f infra/eksctl/cluster.yaml
     ```

## Checklist pós-provisionamento

- [ ] Subnets taggeadas corretamente (`kubernetes.io/cluster/lab-eks`)
- [ ] `kubectl get nodes` mostra 1 nó `t4g.medium` (Spot)
- [ ] Logs do control plane habilitados (CloudWatch)
- [ ] Add-ons rodando (`kubectl get pods -n kube-system`)
- [ ] Ingress público emitindo DNS via ALB
- [ ] Registro `app.finfy.me` (ou similar) apontando para o ALB

> Dica: salve as variáveis sensíveis (ARNs, certificate ARN, etc.) em `terraform.tfvars`/Secrets Manager se for automatizar.
