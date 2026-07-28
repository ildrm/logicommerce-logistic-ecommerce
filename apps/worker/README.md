# Worker

Separate NestJS application context for transactional-outbox publication,
inventory-reservation expiry, webhook delivery, and overdue driver-check-in
detection. Jobs are repeatable, tenant-scoped, redacted, and designed to avoid
duplicate operational exceptions.

The international sweep also expires insurance quotes/coverage, emits a
single durable missed-cutoff event per consolidation, and emits a single late
handover event per postal dispatch. It does not silently advance physical
custody state.
