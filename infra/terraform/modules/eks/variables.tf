variable "cluster_name" {
	type = string
}

variable "eks_version" {
	type    = string
	default = "1.29"
}

variable "vpc_id" {
	type = string
}

variable "private_subnet_ids" {
	type = list(string)
}

variable "public_subnet_ids" {
	type    = list(string)
	default = []
}

variable "instance_types" {
	type    = list(string)
	default = ["m7g.large", "m6i.large"]
}

variable "desired_size" {
	type    = number
	default = 3
}

variable "min_size" {
	type    = number
	default = 2
}

variable "max_size" {
	type    = number
	default = 6
}

variable "allowed_cidrs" {
	type    = list(string)
	default = ["0.0.0.0/0"]
}

variable "enable_cluster_log_types" {
	type    = list(string)
	default = ["api", "audit", "authenticator"]
}

variable "tags" {
	type    = map(string)
	default = {}
}
