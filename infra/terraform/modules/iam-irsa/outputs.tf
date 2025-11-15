output "ebs_csi_role_arn" {
	description = "IAM Role ARN for EBS CSI Driver"
	value       = aws_iam_role.ebs_csi.arn
}
output "cluster_autoscaler_role_arn" { value = aws_iam_role.cluster_autoscaler.arn }
