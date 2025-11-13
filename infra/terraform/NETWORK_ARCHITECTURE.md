# Configuração de Rede EKS - Control Plane e Nodes

## 🏗️ Arquitetura Implementada

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
│                            ↕                                 │
│                    Internet Gateway                          │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼─────────┐       ┌─────────▼─────────┐
    │  Public Subnet A  │       │  Public Subnet B  │
    │  10.140.0.0/24    │       │  10.140.1.0/24    │
    │  (us-east-1a)     │       │  (us-east-1b)     │
    │                   │       │                   │
    │  🎯 EKS Control   │       │  🎯 EKS Control   │
    │     Plane ENIs    │       │     Plane ENIs    │
    │                   │       │                   │
    │  ☁️  NAT Gateway  │       │                   │
    └─────────┬─────────┘       └───────────────────┘
              │
              │ (NAT)
              │
    ┌─────────▼─────────┐       ┌───────────────────┐
    │ Private Subnet A  │       │ Private Subnet B  │
    │ 10.140.10.0/24    │       │ 10.140.11.0/24    │
    │ (us-east-1a)      │       │ (us-east-1b)      │
    │                   │       │                   │
    │  🖥️  EKS Nodes    │       │  🖥️  EKS Nodes    │
    │     (Spot)        │       │     (Spot)        │
    └───────────────────┘       └───────────────────┘
```

## ✅ Configuração Correta

### Control Plane (Master Nodes)
- **Localização**: Subnets PÚBLICAS (10.140.0.0/24, 10.140.1.0/24)
- **Acesso**: Internet Gateway (IGW)
- **Endpoint**: Público + Privado
- **Por quê?**: 
  - Permite que LoadBalancers externos funcionem
  - Control plane precisa ser acessível pelas subnets públicas
  - Kubernetes API acessível via internet (com CIDR restriction)

### Worker Nodes
- **Localização**: Subnets PRIVADAS (10.140.10.0/24, 10.140.11.0/24)
- **Acesso Internet**: NAT Gateway
- **Por quê?**:
  - Segurança: nodes não têm IP público direto
  - Pull de imagens do ECR via NAT
  - Comunicação com control plane via ENIs
  - LoadBalancers conseguem rotear para os nodes

## 🔧 Configuração Terraform

### Control Plane Subnet Configuration
```hcl
# modules/eks/main.tf
module "eks" {
  # Control plane ENIs em subnets PÚBLICAS
  subnet_ids               = concat(var.public_subnet_ids, var.private_subnet_ids)
  control_plane_subnet_ids = var.public_subnet_ids
  
  # Endpoint acessível publicamente E privativamente
  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"]  # Restringir em produção!
  cluster_endpoint_private_access      = true
}
```

### Node Group Configuration
```hcl
eks_managed_node_groups = {
  default = {
    # Nodes em subnets PRIVADAS
    subnet_ids = var.private_subnet_ids
    
    # Resto da configuração...
  }
}
```

### Subnet Tags (essencial para Load Balancers)
```hcl
# Public subnets
public_subnet_tags = {
  "kubernetes.io/role/elb"                    = "1"
  "kubernetes.io/cluster/${var.cluster_name}" = "shared"
}

# Private subnets
private_subnet_tags = {
  "kubernetes.io/role/internal-elb"           = "1"
  "kubernetes.io/cluster/${var.cluster_name}" = "shared"
}
```

## 🌐 Como os LoadBalancers Funcionam

### LoadBalancer Externo (tipo: LoadBalancer)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer  # ← Cria NLB/CLB público
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
```

**Fluxo**:
1. AWS Load Balancer Controller detecta Service tipo LoadBalancer
2. Cria NLB nas subnets PÚBLICAS (tag `kubernetes.io/role/elb`)
3. NLB roteia tráfego para nodes nas subnets PRIVADAS
4. Nodes têm acesso via NAT Gateway

### LoadBalancer Interno (annotations)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: internal-app
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-internal: "true"
spec:
  type: LoadBalancer  # ← Cria NLB interno
  selector:
    app: internal-app
  ports:
    - port: 80
```

**Fluxo**:
1. Cria NLB nas subnets PRIVADAS (tag `kubernetes.io/role/internal-elb`)
2. Acessível apenas dentro da VPC

### Ingress (ALB)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
spec:
  ingressClassName: alb
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

**Fluxo**:
1. AWS Load Balancer Controller cria ALB
2. ALB em subnets PÚBLICAS (internet-facing) ou PRIVADAS (internal)
3. Target groups apontam para pods nos nodes

## 🔐 Segurança

### Network Flow
```
Internet → IGW → Public Subnets → (Control Plane API)
                                → (Load Balancers)
                                ↓
                         Private Subnets → Nodes
                                ↓
                         NAT Gateway → Internet (outbound)
```

### Security Groups
- **Control Plane SG**: Permite 443 de anywhere (ou CIDR restrito)
- **Node SG**: 
  - Ingress: Do control plane (kubelet, etc)
  - Ingress: Entre nodes
  - Egress: Para internet via NAT

## 📊 Diferença da Configuração Anterior

### ❌ ANTES (Incorreto)
```hcl
subnet_ids               = var.private_subnet_ids
control_plane_subnet_ids = var.private_subnet_ids
```
**Problema**: Control plane em subnets privadas → LoadBalancers não conseguiam rotear corretamente

### ✅ AGORA (Correto)
```hcl
subnet_ids               = concat(var.public_subnet_ids, var.private_subnet_ids)
control_plane_subnet_ids = var.public_subnet_ids
```
**Benefício**: Control plane acessível em subnets públicas → LoadBalancers funcionam perfeitamente

## 🧪 Validação

### Após deploy, verificar:

```bash
# 1. Ver subnets do control plane
aws eks describe-cluster --name oraex-lab-eks \
  --query 'cluster.resourcesVpcConfig.subnetIds' \
  --region us-east-1

# 2. Verificar ENIs do control plane
aws ec2 describe-network-interfaces \
  --filters "Name=description,Values=*oraex-lab-eks*" \
  --query 'NetworkInterfaces[*].[NetworkInterfaceId,SubnetId,PrivateIpAddress]' \
  --region us-east-1

# 3. Testar criação de LoadBalancer
kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --type=LoadBalancer --port=80

# 4. Ver LoadBalancer criado
kubectl get svc nginx
# Deve mostrar EXTERNAL-IP (NLB público)
```

## 📚 Referências

- [EKS Cluster Endpoint Access](https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [EKS Best Practices - Networking](https://aws.github.io/aws-eks-best-practices/networking/vpc-design/)
