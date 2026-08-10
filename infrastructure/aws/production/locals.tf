locals {
  name = "logicommerce-${var.environment}"
  tags = merge(
    {
      Application = "logicommerce"
      Environment = var.environment
      ManagedBy   = "terraform"
      DataClass   = "confidential"
    },
    var.tags,
  )

  public_cidrs  = [for index, _ in var.availability_zones : cidrsubnet("10.40.0.0/16", 4, index)]
  private_cidrs = [for index, _ in var.availability_zones : cidrsubnet("10.40.0.0/16", 4, index + 4)]

  repositories = toset(["api", "migrate", "worker", "web"])
  log_groups   = toset(["api", "worker", "web", "migrate"])

  common_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "API_PORT", value = "3001" },
    { name = "DATABASE_HOST", value = aws_db_instance.mysql.address },
    { name = "DATABASE_PORT", value = tostring(aws_db_instance.mysql.port) },
    { name = "DATABASE_NAME", value = var.database_name },
    { name = "DATABASE_USER", value = var.database_username },
    { name = "CORS_ORIGINS", value = "https://${var.domain_name}" },
    { name = "PUBLIC_BASE_URL", value = "https://${var.domain_name}" },
    { name = "COOKIE_SECURE", value = "true" },
    { name = "S3_ENDPOINT", value = "https://s3.${var.aws_region}.amazonaws.com" },
    { name = "S3_PUBLIC_ENDPOINT", value = "https://s3.${var.aws_region}.amazonaws.com" },
    { name = "S3_REGION", value = var.aws_region },
    { name = "S3_BUCKET", value = aws_s3_bucket.documents.id },
    { name = "LOG_LEVEL", value = "info" },
    { name = "PAYMENT_ADAPTER", value = "stripe" },
    { name = "COMMERCE_ADAPTER", value = "http" },
    { name = "CARRIER_ADAPTER", value = "http" },
    { name = "IDENTITY_VERIFICATION_ADAPTER", value = "http" },
    { name = "C2C_PAYMENT_ADAPTER", value = "http" },
    { name = "DOCUMENT_SCANNER_ADAPTER", value = "http" },
    { name = "EMAIL_ADAPTER", value = "smtp" },
    { name = "SMTP_PORT", value = "465" },
    { name = "SMTP_SECURE", value = "true" },
    { name = "PARTNER_WEBHOOK_ADAPTER", value = "http" },
  ]

  secret_keys = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_PEPPER",
    "FIELD_ENCRYPTION_KEY",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "COMMERCE_PROVIDER_URL",
    "COMMERCE_PROVIDER_TOKEN",
    "CARRIER_PROVIDER_URL",
    "CARRIER_PROVIDER_TOKEN",
    "IDENTITY_VERIFICATION_URL",
    "IDENTITY_VERIFICATION_TOKEN",
    "C2C_PAYMENT_PROVIDER_URL",
    "C2C_PAYMENT_PROVIDER_TOKEN",
    "DOCUMENT_SCANNER_URL",
    "DOCUMENT_SCANNER_TOKEN",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "PARTNER_WEBHOOK_ALLOWED_HOSTS",
  ]

  container_secrets = [
    for key in local.secret_keys : {
      name      = key
      valueFrom = "${aws_secretsmanager_secret.application.arn}:${key}::"
    }
  ]
}
