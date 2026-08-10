# Spec: Production Release Readiness

**Author:** Codex
**Date:** 2026-08-10
**Status:** Approved by the user's 2026-08-10 implementation directive
**Reviewers:** Repository owner; production operations owner before deployment
**Related documents:** `docs/operations/production-readiness.md`, `docs/open-decisions.md`

## Context

Phases 0–13 are implemented and the current `main` branch passes repository, container-build,
live-integration, browser, dependency, source-security, and SBOM jobs. The repository remains a
release candidate because its automated coverage gate does not represent the declared
domain-critical target, built images are not scanned, several public recovery endpoints lack
dedicated abuse limits, the web response lacks a CSP, and no reviewable production cloud topology
is supplied.

The user directed completion without selecting a deployment vendor. This specification therefore
adopts AWS `eu-west-1` as a reference profile and produces reviewable infrastructure and release
controls without applying billable resources. External commercial, legal, regulatory, penetration,
and provider certification evidence remains the responsibility of authorized specialists.

## Functional Requirements

- FR-1: CI MUST build immutable API, worker, and web images and MUST scan every built image for
  critical and high vulnerabilities.
- FR-2: CI MUST publish a source SBOM and MUST enforce at least 80% line, statement, branch, and
  function coverage for an explicitly versioned domain-critical source manifest.
- FR-3: Password-reset, passwordless-login, and email-verification requests MUST use a
  tenant-aware, privacy-preserving rate limit and MUST return HTTP 429 after the configured limit.
- FR-4: Web responses MUST include a production-safe Content Security Policy and the existing
  anti-sniffing, referrer, and permissions headers.
- FR-5: Public list endpoints changed by this release MUST remain backward compatible and MUST
  enforce a bounded maximum result size.
- FR-6: The repository MUST provide an AWS reference architecture for private ECS workloads,
  managed MySQL and Redis, versioned S3 storage, TLS ingress, WAF, encrypted secrets, backups,
  autoscaling, and durable logs/alarms.
- FR-7: Production deployment MUST be a separately approved workflow using immutable image
  digests, a protected GitHub environment, workload identity, health gates, and an explicit
  rollback path. CI MUST NOT automatically deploy a push to `main`.
- FR-8: Release evidence MUST distinguish automated evidence from manual or third-party
  attestations and MUST fail closed when required evidence is absent.
- FR-9: The repository MUST contain release notes describing capabilities, migrations,
  security changes, deployment requirements, rollback, and unresolved external gates.

## Non-Functional Requirements

- **NFR-S1:** No production secret MUST be stored in Git, OpenTofu state output, image metadata, or
  workflow logs.
- **NFR-S2:** Runtime containers MUST run as non-root users in private subnets with least-privilege
  IAM and security groups.
- **NFR-S3:** TLS 1.2 or newer MUST terminate at the production ingress; HTTP MUST redirect to HTTPS.
- **NFR-R1:** The reference topology MUST support at least two API and two web tasks across at least
  two availability zones.
- **NFR-R2:** MySQL and object storage MUST be encrypted, backed up, and protected from accidental
  deletion; restore evidence remains a deployment gate.
- **NFR-O1:** Runtime logs MUST be structured, retained for at least 30 days, and alarm on unhealthy
  targets, 5xx rates, task count, database saturation, and queue/dead-letter signals.
- **NFR-P1:** Existing p95 API latency objective remains 150 ms at the documented control-plane
  workload; infrastructure changes MUST NOT weaken that objective.

## Acceptance Criteria

### AC-1: Image security gate (FR-1)

Given a CI run for a commit, when all three production images are built, then each image is scanned
and any critical or high finding fails its job.

### AC-2: Domain-critical coverage (FR-2)

Given the versioned critical-source manifest, when the coverage command runs, then all four coverage
dimensions are at least 80% and a machine-readable summary is retained.

### AC-3: Recovery abuse protection (FR-3)

Given repeated recovery requests for the same tenant, normalized identity, and IP, when the limit is
exceeded, then the API returns 429 and neither the raw identity nor token appears in the Redis key.

### AC-4: Web security headers (FR-4, NFR-S3)

Given any web route, when the response is returned, then it contains CSP, nosniff, referrer, and
permissions policies and the policy denies framing and object embedding.

### AC-5: Bounded lists (FR-5)

Given more records than the endpoint maximum, when an affected list endpoint is called without new
query parameters, then it returns no more than the documented maximum while preserving its existing
array response contract.

### AC-6: Infrastructure validation (FR-6, NFR-S1, NFR-S2, NFR-R1, NFR-R2, NFR-O1)

Given the AWS reference configuration, when OpenTofu formatting and static validation run, then the
configuration is syntactically valid and exposes no secret values as outputs.

### AC-7: Controlled release workflow (FR-7)

Given a signed release tag and an approved production environment, when the release workflow runs,
then it authenticates through GitHub OIDC, references immutable images, waits for service stability,
and provides a documented rollback command.

### AC-8: Evidence gate and notes (FR-8, FR-9)

Given a proposed production release, when the evidence checker runs, then missing manual attestations
produce a non-zero result and the release notes clearly label them as blockers rather than successes.

## Edge Cases and Error Scenarios

- EC-1: Redis unavailable during a recovery request → fail closed with 503; do not send email.
- EC-2: CSP blocks a required first-party asset → browser regression fails before release.
- EC-3: Image scanner cannot download its vulnerability database → security job fails.
- EC-4: OpenTofu backend, AWS account, DNS zone, or certificate is absent → plan/deploy stops
  without creating partial application resources.
- EC-5: ECS deployment fails health checks → workflow stops and operator follows the documented
  rollback without running database down-migrations.
- EC-6: Provider, legal, penetration, or restore evidence is missing → release remains blocked.

## API Contracts

Existing success bodies remain unchanged for `POST /api/v1/auth/password-reset/request`,
`POST /api/v1/auth/passwordless/request`, and `POST /api/v1/auth/email-verification/request`.
Those endpoints additionally expose:

```typescript
interface RateLimitProblem {
  type: string;
  title: 'Request failed';
  status: 429;
  code: 'HTTP_429';
  detail: string;
  instance: string;
  requestId: string;
  errors: [];
}
```

Affected list endpoints retain their existing array responses and apply a server-side maximum of
100 records. No required request field or response field is added by this release.

## Data Models

No application database schema change is required.

| Field          | Type                 | Constraints                                         |
| -------------- | -------------------- | --------------------------------------------------- |
| rate-limit key | Redis string         | Tenant scoped; identity and IP are SHA-256 hashed   |
| counter        | Integer              | Positive; expires with the configured fixed window  |
| OpenTofu state | Operational metadata | Encrypted remote backend; locked; no secret outputs |

## Out of Scope

- OS-1: Creating or paying for AWS resources; IaC is generated and validated but apply requires
  an authorized account owner.
- OS-2: Fabricating provider sandbox certification, a penetration-test report, legal advice,
  regulatory approval, licensed datasets, or insurance/customs/postal agreements.
- OS-3: Choosing a launch legal entity or market. Activation remains disabled until those
  decisions are signed in the release evidence record.
- OS-4: Database down-migrations. Rollback uses compatible application images and forward data
  correction because financial, inventory, and audit histories are append-only.
