# AWS production deployment

This directory is the production reference deployment for LogiCommerce. It
uses ECS Fargate behind an ALB and WAF, Multi-AZ RDS MySQL, encrypted Valkey,
an encrypted/versioned S3 document bucket, immutable ECR repositories,
Secrets Manager, CloudWatch logs and alarms, and private application subnets
across three availability zones.

OpenTofu does not create DNS, an ACM certificate, the remote state bucket,
the GitHub OIDC role, an SNS subscription, or application secret values. Those
resources have organization-specific ownership and must exist before the
protected release workflow runs.

## Prerequisites

1. Create an encrypted, versioned S3 state bucket with state locking.
2. Create a least-privilege GitHub Actions OIDC role scoped to this repository
   and the protected `production` environment.
3. Issue or import an ACM certificate for the production domain in the selected
   region and create an SNS alarm topic with an acknowledged subscription.
4. Install OpenTofu 1.10.6. Copy `terraform.tfvars.example` to an untracked
   `.tfvars` file and replace every example value.
5. Run `tofu init` with the same backend settings used by
   `.github/workflows/release.yml`, then review `tofu plan`.

Use the following GitHub environment variables:

- `AWS_ACCOUNT_ID`, `AWS_REGION`, and `AWS_RELEASE_ROLE_ARN`
- `PRODUCTION_DOMAIN`, `PRODUCTION_CERTIFICATE_ARN`, and
  `PRODUCTION_ALARM_TOPIC_ARN`
- `TF_STATE_BUCKET` and `TF_STATE_KEY`

The release role needs only the AWS and state permissions required by this
configuration. Protect the environment with required reviewers and restrict it
to the release branch.

## One-time bootstrap

The state backend must exist before OpenTofu initialization. Provision the
KMS key, ECR repositories, network, data stores, secret shell, cluster, logs,
roles, load balancer, and WAF under a reviewed bootstrap change before the
first application release. Do not create placeholder production services with
mutable or unscanned images.

Populate the output `application_secret_arn` through the approved secrets
workflow. Its JSON object must contain every key in `local.secret_keys`.
Provider values must select real production adapters; mock adapters are rejected
by application startup validation. `DATABASE_URL` must use the managed RDS
endpoint, and `REDIS_URL` must use `rediss://` and the managed Valkey endpoint.

The current object signer consumes an access-key pair. Create that credential
outside OpenTofu so it does not enter state, scope it only to the output
document bucket and KMS key, store it as `S3_ACCESS_KEY`/`S3_SECRET_KEY`, and
rotate it under the secrets policy. The ECS task role is separately restricted
to the same bucket.

## Release and rollback

1. Complete every gate in `release/evidence.json` with a current HTTPS evidence
   reference and merge it through CI.
2. Trigger **Production release** with the full SHA of that green commit and
   the confirmation `DEPLOY`.
3. The workflow checks evidence, coverage, and Compose configuration; assumes
   the OIDC role; creates immutable ECR repositories if needed; builds and scans
   all images; pushes SHA tags; runs the forward migration task; applies the
   reviewed infrastructure plan; waits for stable services; and verifies the
   readiness endpoint.
4. Point DNS at `load_balancer_dns_name` only after the first deployment is
   healthy.

Application rollback uses the last known-good commit SHA as `image_tag` and a
reviewed OpenTofu plan. Database migrations must be backward-compatible across
the deployment window; use a forward corrective migration after a schema write.
Never roll state backward or delete protected RDS/S3 resources. Follow
`docs/operations/incident-rollout-runbook.md` for stop/go decisions and
`docs/operations/backup-restore-runbook.md` for recovery.

## Validation

Run `tofu fmt -check -recursive`, `tofu validate`, and a plan in the
target AWS account before approval. `prevent_destroy` and deletion protection
are intentionally enabled for persistent production data. A plan requesting
replacement or deletion of RDS, S3, or Secrets Manager resources is a stop
condition.
