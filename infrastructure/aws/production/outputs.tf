output "load_balancer_dns_name" {
  description = "Create the production DNS alias against this name after health verification."
  value       = aws_lb.this.dns_name
}

output "application_secret_arn" {
  description = "Populate this secret through the approved out-of-band workflow before deployment."
  value       = aws_secretsmanager_secret.application.arn
}

output "document_bucket_name" {
  value = aws_s3_bucket.documents.id
}

output "ecr_repository_urls" {
  value = { for name, repository in aws_ecr_repository.application : name => repository.repository_url }
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "application_security_group_id" {
  value = aws_security_group.application.id
}

output "migration_task_definition_arn" {
  value = aws_ecs_task_definition.migrate.arn
}

output "ecs_service_names" {
  value = [aws_ecs_service.api.name, aws_ecs_service.web.name, aws_ecs_service.worker.name]
}
