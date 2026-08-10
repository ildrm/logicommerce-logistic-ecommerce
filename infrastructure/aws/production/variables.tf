variable "aws_region" {
  description = "AWS region for the production stack."
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Public application domain covered by certificate_arn."
  type        = string
}

variable "certificate_arn" {
  description = "Validated ACM certificate ARN for domain_name."
  type        = string
}

variable "image_tag" {
  description = "Immutable image tag, normally the release commit SHA."
  type        = string

  validation {
    condition     = can(regex("^[a-f0-9]{40}$", var.image_tag))
    error_message = "image_tag must be a full 40-character Git commit SHA."
  }
}

variable "availability_zones" {
  description = "Three availability zones in aws_region."
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "database_name" {
  type    = string
  default = "logicommerce"
}

variable "database_username" {
  type    = string
  default = "logicommerce"
}

variable "database_instance_class" {
  type    = string
  default = "db.r7g.large"
}

variable "database_allocated_storage" {
  type    = number
  default = 100
}

variable "redis_node_type" {
  type    = string
  default = "cache.r7g.large"
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "worker_desired_count" {
  type    = number
  default = 2
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "backup_retention_days" {
  type    = number
  default = 35
}

variable "deletion_protection" {
  description = "Must remain true for production."
  type        = bool
  default     = true

  validation {
    condition     = var.deletion_protection
    error_message = "Production deletion protection cannot be disabled by this module."
  }
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN owned by the production on-call team."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
