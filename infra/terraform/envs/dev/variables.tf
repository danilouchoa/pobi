variable "cluster_name" {
  type = string
}

variable "eks_version" {
  type = string
}

variable "instance_types" {
  type = list(string)
}

variable "desired_size" {
  type = number
}

variable "min_size" {
  type = number
}

variable "max_size" {
  type = number
}

variable "allowed_cidrs" {
  type = list(string)
}

variable "tf_backend_bucket" {
  type = string
}

variable "tf_backend_table" {
  type = string
}

variable "tf_backend_key" {
  type = string
}
