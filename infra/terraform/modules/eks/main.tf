terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.8" # 20.x supports k8s 1.29+

  cluster_name    = var.cluster_name
  cluster_version = var.eks_version

  vpc_id                   = var.vpc_id
  
  # Control plane ENIs em subnets PÚBLICAS (para LoadBalancer externo funcionar)
  # Nodes continuam em subnets privadas
  subnet_ids               = concat(var.public_subnet_ids, var.private_subnet_ids)
  control_plane_subnet_ids = var.public_subnet_ids

  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = var.allowed_cidrs
  cluster_endpoint_private_access      = true  # Habilita acesso privado também

  enable_irsa = true

  cluster_enabled_log_types = var.enable_cluster_log_types

  eks_managed_node_group_defaults = {
    ami_type        = "AL2023_ARM_64_STANDARD"
    disk_size       = 50
    create_iam_role = true
    iam_role_use_name_prefix = true
  }

  eks_managed_node_groups = {
    default = {
      instance_types = var.instance_types
      min_size       = var.min_size
      max_size       = var.max_size
      desired_size   = var.desired_size
      
      # Nodes em subnets PRIVADAS (com NAT Gateway para internet)
      subnet_ids     = var.private_subnet_ids
      
      capacity_type  = "SPOT"
      
      labels = {
        "node.kubernetes.io/lifecycle" = "spot"
      }
      
      tags = merge(var.tags, {
        # Tag para o AWS Load Balancer Controller descobrir os nodes
        "kubernetes.io/cluster/${var.cluster_name}" = "owned"
      })
    }
  }

  tags = var.tags
}
