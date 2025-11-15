# Ambiente dev

1. Edite `terraform.tfvars` baseado no exemplo.
2. `terraform init && terraform plan`.
3. `terraform apply`.
4. Exporte kubeconfig: `../../../../scripts/kubeconfig.sh`.
5. Bootstrap ArgoCD: `../../../../scripts/bootstrap-argocd.sh`.
