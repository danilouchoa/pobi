# Estratégia de Instâncias Spot - EKS Node Group

## 🎯 Objetivo
Usar múltiplos tipos de instâncias ARM64 Spot para:
- ✅ Maximizar disponibilidade de capacidade Spot
- ✅ Reduzir custos (Spot pode ser até 90% mais barato)
- ✅ Minimizar interrupções (diversificação)

## 📊 Instâncias Configuradas

### T4g - Burstable (Menor Custo)
- **t4g.medium** (2 vCPU, 4 GB RAM)
- **t4g.large** (2 vCPU, 8 GB RAM)
- **Uso**: Workloads com CPU variável
- **Preço Spot**: ~$0.0084/hora (vs $0.0336 On-Demand)

### M7g - General Purpose (Graviton3 - 7th Gen)
- **m7g.medium** (1 vCPU, 4 GB RAM)
- **m7g.large** (2 vCPU, 8 GB RAM)
- **Uso**: Workloads balanceados
- **Preço Spot**: ~$0.0116/hora
- **Performance**: +25% melhor que M6g

### M7g-flex - General Purpose Flex
- **m7g-flex.medium** (1 vCPU, 4 GB RAM)
- **m7g-flex.large** (2 vCPU, 8 GB RAM)
- **Uso**: Melhor custo-benefício para workloads gerais
- **Preço Spot**: ~$0.0104/hora

### M6g - General Purpose (Graviton2 - 6th Gen)
- **m6g.medium** (1 vCPU, 4 GB RAM)
- **m6g.large** (2 vCPU, 8 GB RAM)
- **Uso**: Workloads gerais
- **Preço Spot**: ~$0.0096/hora

### C7g - Compute Optimized (Graviton3)
- **c7g.medium** (1 vCPU, 2 GB RAM)
- **c7g.large** (2 vCPU, 4 GB RAM)
- **Uso**: Workloads com alta demanda de CPU
- **Preço Spot**: ~$0.0108/hora
- **Performance**: +25% melhor que C6g

### C6g - Compute Optimized (Graviton2)
- **c6g.medium** (1 vCPU, 2 GB RAM)
- **c6g.large** (2 vCPU, 4 GB RAM)
- **Uso**: Workloads intensivos em CPU
- **Preço Spot**: ~$0.0086/hora

## 🔄 Como Funciona

### 1. Diversificação Automática
O EKS tentará provisionar nodes usando qualquer uma das instâncias disponíveis:
```
Tentativa 1: t4g.medium → Sem capacidade
Tentativa 2: m7g.medium → ✅ Sucesso!
```

### 2. Auto Scaling Group
- **Min Size**: 2 nodes
- **Desired Size**: 3 nodes
- **Max Size**: 6 nodes

### 3. Spot Instance Interruption Handling
Quando uma instância Spot é interrompida:
1. AWS envia aviso 2 minutos antes
2. Kubernetes drena os pods para outros nodes
3. EKS provisiona novo node automaticamente
4. Usa outro tipo de instância se necessário

## 💰 Economia Estimada

### Cenário: 3 nodes rodando 24/7 (mês)

**On-Demand (t4g.medium apenas):**
```
3 nodes × $0.0336/hora × 730 horas = $73.58/mês
```

**Spot (mix diversificado):**
```
3 nodes × ~$0.010/hora média × 730 horas = $21.90/mês
```

**Economia: ~70% ($51.68/mês)** 💰

## ⚙️ Configuração no Terraform

```hcl
instance_types = [
  # T4g - Burstable
  "t4g.medium",
  "t4g.large",
  
  # M7g - General Purpose (7th gen)
  "m7g.medium",
  "m7g.large",
  
  # M7g-flex - General Purpose Flex
  "m7g-flex.medium",
  "m7g-flex.large",
  
  # M6g - General Purpose (6th gen)
  "m6g.medium",
  "m6g.large",
  
  # C7g - Compute Optimized (7th gen)
  "c7g.medium",
  "c7g.large",
  
  # C6g - Compute Optimized (6th gen)
  "c6g.medium",
  "c6g.large",
]
```

## 📈 Monitoramento de Spot Interruptions

### Ver eventos de interrupção:
```bash
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | grep -i spot
```

### Instalar Node Termination Handler (Recomendado):
```bash
kubectl apply -f https://github.com/aws/aws-node-termination-handler/releases/download/v1.22.0/all-resources.yaml
```

### Ver status dos nodes:
```bash
kubectl get nodes -L node.kubernetes.io/lifecycle
```

## 🎯 Best Practices Implementadas

### ✅ 1. Diversificação de Tipos
- 12 tipos diferentes de instâncias
- Mix de gerações (6th e 7th gen)
- Mix de famílias (T, M, C)

### ✅ 2. Mesmo Arquitetura
- Todas ARM64 (Graviton2/3)
- Compatibilidade garantida

### ✅ 3. Tamanhos Similares
- Todas medium ou large
- Recursos balanceados

### ✅ 4. Labels Kubernetes
```yaml
labels:
  node.kubernetes.io/lifecycle: spot
```

## 🚨 Considerações

### Quando Spot NÃO é recomendado:
- ❌ Workloads stateful críticos (databases)
- ❌ Jobs que não podem ser interrompidos
- ❌ Aplicações sem redundância

### Quando Spot É PERFEITO:
- ✅ APIs stateless (nosso finance-app)
- ✅ Workers de processamento
- ✅ Batch jobs
- ✅ CI/CD pipelines
- ✅ Desenvolvimento/staging

## 📊 Verificar Disponibilidade Spot

```bash
# Ver preços Spot atuais
aws ec2 describe-spot-price-history \
  --instance-types t4g.medium m7g.medium c7g.medium \
  --product-descriptions "Linux/UNIX" \
  --region us-east-1 \
  --query 'SpotPriceHistory[*].[InstanceType,SpotPrice,AvailabilityZone]' \
  --output table

# Ver taxa de interrupção histórica
# Visite: https://aws.amazon.com/ec2/spot/instance-advisor/
```

## 🔧 Troubleshooting

### Nodes não sobem:
```bash
# Ver eventos do Auto Scaling Group
aws autoscaling describe-auto-scaling-groups \
  --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'oraex-lab-eks')]" \
  --region us-east-1

# Ver atividades do ASG
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name <asg-name> \
  --max-records 10
```

### Todos os tipos sem capacidade (raro):
1. Aumentar lista de instance_types
2. Considerar adicionar On-Demand como fallback
3. Mudar para outra região/AZ

## 🎓 Recursos

- [AWS Spot Best Practices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-best-practices.html)
- [EKS Spot Best Practices](https://aws.github.io/aws-eks-best-practices/cost_optimization/cost_opt_compute/#use-ec2-spot-instances-for-cost-optimization)
- [Spot Instance Advisor](https://aws.amazon.com/ec2/spot/instance-advisor/)
- [Graviton Performance](https://github.com/aws/aws-graviton-getting-started)
