# ADR 0004: REST-first APIs

Status: Accepted.

Version endpoints under `/api/v1`, generate OpenAPI from real DTOs, return
problem-details errors, and require idempotency for creates/transitions.
