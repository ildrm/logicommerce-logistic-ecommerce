# ADR 0005: Transactional outbox

Status: Accepted.

Persist integration events beside business state, publish asynchronously, and
deduplicate consumers. This prevents database/event dual-write inconsistency.
