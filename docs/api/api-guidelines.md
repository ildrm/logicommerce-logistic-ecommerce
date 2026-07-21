# API guidelines

REST endpoints use `/api/v1`, UUID identifiers, JSON, cursor or page pagination,
request/correlation IDs, explicit authorization, and problem-details responses.
Create and transition operations require `Idempotency-Key`. Stack traces and
record-existence details for unauthorized cross-tenant access are never returned.
