# Worker

Separate NestJS application context for outbox publication and future BullMQ
processors. Job payloads are versioned, validated, idempotent, and redacted.
