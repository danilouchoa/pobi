locals {
  common_tags = {
    Environment = "lab"
    shutdown    = "true"
  }
}

data "aws_eks_addon_version" "coredns" {
  addon_name         = "coredns"
  kubernetes_version = var.eks_version
  most_recent        = true
}

data "aws_eks_addon_version" "kube_proxy" {
  addon_name         = "kube-proxy"
  kubernetes_version = var.eks_version
  most_recent        = true
}

data "aws_eks_addon_version" "vpc_cni" {
  addon_name         = "vpc-cni"
  kubernetes_version = var.eks_version
  most_recent        = true
}

data "aws_eks_addon_version" "aws_ebs_csi_driver" {
  addon_name         = "aws-ebs-csi-driver"
  kubernetes_version = var.eks_version
  most_recent        = true
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.cluster_name}-vpc"
  cidr = "10.140.0.0/16"

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.140.10.0/24", "10.140.11.0/24"]
  public_subnets  = ["10.140.0.0/24", "10.140.1.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Tags para EKS descobrir as subnets e AWS Load Balancer Controller
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  tags = local.common_tags
}

module "eks" {
  source             = "../../modules/eks"
  cluster_name       = var.cluster_name
  eks_version        = var.eks_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnets
  public_subnet_ids  = module.vpc.public_subnets
  instance_types     = var.instance_types
  desired_size       = var.desired_size
  min_size           = var.min_size
  max_size           = var.max_size
  allowed_cidrs      = var.allowed_cidrs
  tags               = local.common_tags

  depends_on = [module.vpc]
}

module "iam_irsa" {
  source            = "../../modules/iam-irsa"
  cluster_name      = module.eks.cluster_name
  oidc_provider_arn = module.eks.oidc_provider_arn
  tags              = local.common_tags

  depends_on = [module.eks]
}

resource "aws_eks_addon" "coredns" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "coredns"
  addon_version               = data.aws_eks_addon_version.coredns.version
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  tags                        = local.common_tags

  depends_on = [module.eks]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "kube-proxy"
  addon_version               = data.aws_eks_addon_version.kube_proxy.version
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  tags                        = local.common_tags

  depends_on = [module.eks]
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "vpc-cni"
  addon_version               = data.aws_eks_addon_version.vpc_cni.version
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  tags                        = local.common_tags

  depends_on = [module.eks]
}

resource "aws_eks_addon" "aws_ebs_csi_driver" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "aws-ebs-csi-driver"
  addon_version               = data.aws_eks_addon_version.aws_ebs_csi_driver.version
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  service_account_role_arn    = module.iam_irsa.ebs_csi_role_arn
  tags                        = local.common_tags

  depends_on = [module.iam_irsa, module.eks]
}

# Outputs - VPC
output "vpc_id" { value = module.vpc.vpc_id }
output "vpc_cidr" { value = module.vpc.vpc_cidr_block }
output "public_subnet_ids" { value = module.vpc.public_subnets }
output "private_subnet_ids" { value = module.vpc.private_subnets }
output "nat_gateway_ips" { value = module.vpc.nat_public_ips }

# Outputs - EKS
output "cluster_name" { value = module.eks.cluster_name }
output "cluster_endpoint" { value = module.eks.cluster_endpoint }

# ECR Repositories
resource "aws_ecr_repository" "finance_app" {
  name                 = "finance-app"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = "lab"
    shutdown    = "true"
  }
}

output "finance_app_ecr_url" {
  value = aws_ecr_repository.finance_app.repository_url
}
