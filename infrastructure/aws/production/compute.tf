resource "aws_ecr_repository" "application" {
  for_each = local.repositories

  name                 = "logicommerce/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.this.arn
  }

  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "application" {
  for_each   = aws_ecr_repository.application
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retain the most recent 50 release images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 50
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "application" {
  for_each = local.log_groups

  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.this.arn
}

resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

resource "aws_iam_role" "execution" {
  name = "${local.name}-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.application.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.this.arn]
      },
    ]
  })
}

resource "aws_iam_role" "task" {
  name = "${local.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task" {
  name = "runtime"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:GetObjectAttributes",
          "s3:ListBucket",
          "s3:PutObject",
        ]
        Resource = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
        Resource = [aws_kms_key.this.arn]
      },
    ]
  })
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name                   = "api"
    image                  = "${aws_ecr_repository.application["api"].repository_url}:${var.image_tag}"
    essential              = true
    environment            = local.common_environment
    secrets                = local.container_secrets
    portMappings           = [{ containerPort = 3001, protocol = "tcp" }]
    readonlyRootFilesystem = true
    linuxParameters        = { initProcessEnabled = true }
    mountPoints            = []
    volumesFrom            = []
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application["api"].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:3001/api/v1/health/ready || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.application["web"].repository_url}:${var.image_tag}"
    essential = true
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "NEXT_PUBLIC_API_URL", value = "https://${var.domain_name}/api/v1" },
    ]
    portMappings           = [{ containerPort = 3000, protocol = "tcp" }]
    readonlyRootFilesystem = false
    linuxParameters        = { initProcessEnabled = true }
    mountPoints            = []
    volumesFrom            = []
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application["web"].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "web"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name                   = "worker"
    image                  = "${aws_ecr_repository.application["worker"].repository_url}:${var.image_tag}"
    essential              = true
    environment            = local.common_environment
    secrets                = local.container_secrets
    readonlyRootFilesystem = false
    linuxParameters        = { initProcessEnabled = true }
    mountPoints            = []
    volumesFrom            = []
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application["worker"].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name                   = "migrate"
    image                  = "${aws_ecr_repository.application["migrate"].repository_url}:${var.image_tag}"
    essential              = true
    environment            = local.common_environment
    secrets                = local.container_secrets
    readonlyRootFilesystem = false
    linuxParameters        = { initProcessEnabled = true }
    mountPoints            = []
    volumesFrom            = []
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.application["migrate"].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
}
