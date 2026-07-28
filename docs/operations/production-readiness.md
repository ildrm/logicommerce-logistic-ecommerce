# Production readiness controls

Phase 11 makes operational claims evidence-driven. The API records service-level
objectives, observations, recovery exercises, retention policies, legal holds,
and privacy requests. Runtime request metrics expose bounded aggregate counts,
errors, average duration, and maximum duration; they do not retain request
bodies, tokens, subject identifiers, or query values.

## Release gates

- Repository formatting, lint, type checks, unit coverage, builds, Compose
  configuration, browser journeys, live domain journeys, and tenant-isolation
  checks must pass.
- Domain-critical coverage targets at least 80%. A release must attach the
  measured report rather than infer coverage from file counts.
- The CI security job scans the source tree, built containers, and generates a
  CycloneDX SBOM. Critical or high findings block release unless a documented,
  expiring risk acceptance exists.
- Production migration plans name the forward migration, compatibility window,
  verification query, and rollback decision point.
- Freight/payment activation requires provider sandbox checkout, signed
  duplicate/stale webhook, refund, settlement-reference, database/object-store
  restore, and tenant/permission-denial evidence. The mock payment adapter is
  forbidden in production.

## Runtime objectives

The service availability objective is 99.95% over 30 days. API latency targets
are p50 50 ms, p95 150 ms, and p99 400 ms at the agreed workload. Recovery
exercises pass only when measured RPO is at most 15 minutes and measured RTO is
at most 60 minutes.

In-process metrics are a bounded development baseline, not a horizontally
aggregated production telemetry system. Production must export OpenTelemetry
metrics and traces to durable storage, aggregate across replicas, and alert on
error-budget burn, queue age, dead letters, database saturation, and settlement
or inventory invariant failures.

## Privacy and retention

Privacy requests store only a SHA-256 subject reference. Operators resolve that
reference through an approved identity workflow outside logs and metrics.
Retention policy changes are versioned and record their approver. A legal hold
prevents deletion or anonymization until an authorized operator removes it.
Production retention execution must run as a dry-run first and preserve an
immutable count and digest of affected records.

Driver contacts, optional coordinates, cargo/customs documents, invoice PDFs,
and POD evidence require explicit retention and access policy. Current gaps
that block a fully integrated production claim are SMTP invoice delivery,
active upload malware scanning, automated provider-session reconciliation
polling, tenant freight feature flags, and continuous GPS.
