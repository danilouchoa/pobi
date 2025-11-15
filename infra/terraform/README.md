# Terraform Infra

Este diretório contém os módulos e ambientes para provisionar o EKS (oraex-lab) e IAM (IRSA) com Terraform.

Fluxo sugerido:
- `cd infra/terraform/envs/dev`
- Configure `backend.tf` (S3+DynamoDB) e `terraform.tfvars`
- `terraform init && terraform plan && terraform apply`
- Depois rode `../../../../scripts/kubeconfig.sh` e `../../../../scripts/bootstrap-argocd.sh`
