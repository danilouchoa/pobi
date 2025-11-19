# EKS Cluster Configuration
cluster_name = "oraex-lab-eks"
eks_version  = "1.34"

# VPC será criada automaticamente com CIDR 10.140.0.0/16

# Múltiplos tipos de instâncias ARM64 Spot para melhor disponibilidade
# Spot instances podem ser interrompidas, então diversificar tipos aumenta a chance de conseguir capacidade
instance_types = [
  # T4g - Burstable (menor custo, ótimo para cargas leves)
  "t4g.medium",
  "t4g.large",

  # M7g - General Purpose (7th gen Graviton3 - melhor performance)
  "m7g.medium",
  "m7g.large",

  # M6g - General Purpose (6th gen Graviton2 - mais disponível)
  "m6g.medium",
  "m6g.large",
]

# Auto Scaling do node group
desired_size = 3
min_size     = 2
max_size     = 4

# Ajuste para restringir o acesso ao endpoint da API do EKS (CIDR da sua rede / workstation)
allowed_cidrs = ["0.0.0.0/0"] # ajuste depois para IPs de administração

# Backend remoto (se quiser voltar a usar S3 em vez de local). Usado apenas se reativar o backend s3.
tf_backend_bucket = "oraex-lab-terraform-state"
tf_backend_table  = "oraex-lab-terraform-locks"
tf_backend_key    = "eks/dev/terraform.tfstate"
