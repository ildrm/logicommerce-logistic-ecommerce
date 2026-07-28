# Incident, rollout, and key-rotation runbook

## Incident response

Declare severity, owner, affected tenants, and a communication cadence. Preserve
audit, access, webhook, outbox, and infrastructure evidence. For suspected
cross-tenant access or payout abuse, revoke affected sessions and credentials,
pause payouts and automated delivery, and keep append-only journals intact.
Recovery uses compensating entries and explicit state transitions.

For a freight or payment incident, also preserve raw-signature verification
metadata, durable provider event receipts, quote revisions, booking milestones,
driver check-ins, exceptions, POD evidence, and invoice allocations. A browser
checkout return or unverified location update is never recovery evidence.

## Rollout and rollback

Deploy additive schema changes before readers depend on them. Use a canary,
compare errors, latency, invariant alerts, and queue age, then expand gradually.
Rollback application images only while their schema compatibility window is
valid. Data corrections are forward migrations or compensating records; posted
journals, stock ledger entries, audit events, and executed decisions are never
edited in place.

## Secret and signing-key rotation

Create a new key version in the external secret manager, deploy readers that
accept the old and new versions, switch writers, verify issuance and webhook
signatures, then revoke the old version after the maximum token/replay window.
Record the owner, reason, timestamps, affected key identifiers, verification,
and rollback window. Secrets and raw keys must never enter repository files,
logs, metrics, tickets, or recovery evidence.

Rotate field-encryption, JWT/session, Shop webhook, Stripe webhook, Coinbase
webhook, and object-storage credentials as separate key classes. Driver phone
ciphertext requires a documented re-encryption plan before retiring its
encryption key.
