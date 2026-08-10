resource "aws_kms_key" "this" {
  description             = "${local.name} production data"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "this" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.this.key_id
}

resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "mysql" {
  identifier = local.name

  engine         = "mysql"
  engine_version = "8.4"
  instance_class = var.database_instance_class

  db_name                       = var.database_name
  username                      = var.database_username
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.this.arn

  allocated_storage     = var.database_allocated_storage
  max_allocated_storage = var.database_allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.this.arn

  multi_az               = true
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.database.id]

  backup_retention_period   = var.backup_retention_days
  backup_window             = "01:00-02:00"
  maintenance_window        = "sun:03:00-sun:04:00"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"

  enabled_cloudwatch_logs_exports = ["error", "general", "slowquery"]
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.this.arn

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_elasticache_subnet_group" "this" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = local.name
  description          = "LogiCommerce production queues and rate limits"

  engine                     = "valkey"
  node_type                  = var.redis_node_type
  port                       = 6379
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.this.arn
  snapshot_retention_limit   = 7
  snapshot_window            = "02:00-03:00"
  maintenance_window         = "sun:04:00-sun:05:00"
  auto_minor_version_upgrade = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "documents" {
  bucket_prefix = "logicommerce-${var.environment}-documents-"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.this.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["content-type", "x-amz-checksum-sha256"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = ["https://${var.domain_name}"]
    expose_headers  = ["etag", "x-amz-checksum-sha256"]
    max_age_seconds = 300
  }
}

data "aws_iam_policy_document" "documents" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"
    actions = [
      "s3:*",
    ]
    resources = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id
  policy = data.aws_iam_policy_document.documents.json

  depends_on = [aws_s3_bucket_public_access_block.documents]
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "noncurrent-retention"
    status = "Enabled"
    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER_IR"
    }

    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

resource "aws_secretsmanager_secret" "application" {
  name                    = "${local.name}/application"
  description             = "Populate each required JSON key through the approved secret workflow."
  kms_key_id              = aws_kms_key.this.arn
  recovery_window_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}
