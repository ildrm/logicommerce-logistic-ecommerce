# Implementation Plan: Central tenant-scoped evidence boundary

## Selected Design And Constraints

The user selected Phase 11 implementation. Preserve the modular monolith,
tenant-scoped repositories, deny-by-default permissions, human approval, and
append-only domain evidence.

## Source Revision And Drift Check

The evidence identity is recorded in `../hardening.json`. Source drift is
expected because this handoff accompanies the selected implementation; re-review
if tenant resolution, permission guards, or audit ownership changes.

## Affected Components

`apps/api/src/operability`, `apps/api/src/main.ts`,
`packages/database/prisma`, CI, operations UI, tests, and runbooks.

## Ordered Work Packages

- Add SLO, recovery, retention, legal-hold, and privacy records.
- Add guarded APIs and bounded request metrics.
- Harden ingress and high-impact approval/rollback transitions.
- Add scans, SBOM, runbooks, and automated evidence.

## Compatibility And Migration

Schema changes are additive. Deploy the migration before the application and
retain tables during application rollback.

## Tactical Protections During Migration

Keep current permission guards, tenant filters, rate limits, security headers,
redacted logs, and manual release approval active.

## Tests And Security Validation

Verify cross-tenant non-enumeration, unauthorized transitions, journal balance,
deterministic hashes, metrics redaction, retention/legal hold, and recovery
pass/fail calculation.

## Performance And Resource Benchmarks

Measure API percentiles at agreed load and route-metric RSS/cardinality. Do not
claim the targets until results are recorded.

## Rollout And Rollback

Canary the API, compare errors and latency, then expand. Roll back the
application without dropping additive evidence tables.

## Acceptance Criteria

Every privileged transition records actor and reason; recovery status derives
from RPO/RTO; tenant isolation is automated; provider limitations remain
explicit.

## Open Decisions

Select durable telemetry, backup, secret, and production orchestration providers.
