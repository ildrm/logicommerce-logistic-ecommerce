# Production provider contracts

Production startup rejects local mock, preview, and deterministic provider modes.
Base URLs must be HTTPS and bearer credentials must come from the deployment
secret store. Provider responses are time-bounded, size-bounded, JSON-only where
applicable, and redirects are rejected.

## Commerce

`COMMERCE_PROVIDER_URL` implements authenticated JSON `POST` endpoints for
`/v1/address/validate`, `/v1/tax/quote`, `/v1/shipping/quote`,
`/v1/fraud/assess`, `/v1/payments/authorize`, and `/v1/payments/void`.
Payment authorization and void requests carry stable idempotency keys. A rollout
must verify address normalization, tax rounding, shipping currency, fraud
decisions, duplicate authorization, void replay, timeout, malformed response,
and provider-unavailable behavior.

## Carrier

`CARRIER_PROVIDER_URL/v1/labels` creates a label from a shipment using the
shipment ID as the idempotency key. The response must contain a tracking number,
HTTPS label URL, and non-negative rate. Certification must cover replay,
unsupported service levels, timeouts, and tracking/label retention.

## Identity verification and C2C escrow

`IDENTITY_VERIFICATION_URL/v1/verifications/resolve` resolves an opaque provider
token into an approval decision and stable provider reference.

`C2C_PAYMENT_PROVIDER_URL/v1/escrow/holds` creates a time-bounded hold and
returns its provider/reference. `/v1/escrow/holds/release` must be idempotent for
the supplied release key. Countered, rejected, and expired offers create durable
release jobs in the same database transaction as their terminal transition;
workers retry until the provider acknowledges release. Certification must prove
duplicate holds do not occur, releases are safe to repeat, and provider/database
reconciliation exposes no orphaned terminal holds.

## Document storage and scanner

Presigned PUT requests bind `Content-Type`, exact `Content-Length`, and
`x-amz-checksum-sha256`. The S3-compatible service must validate that checksum
against the received bytes and return it from HEAD after server-side copy.
Metadata mismatch deletes the object and rejects the upload.

`DOCUMENT_SCANNER_URL/v1/documents/scan` receives the object key, short-lived
download URL, media type, exact size, and verified hexadecimal SHA-256. It must
return `clean`, a stable reference, and the same computed checksum. A different
or missing checksum is a failed scan contract. Only `CLEAN` documents can become
proof-of-delivery evidence.

## SMTP

The SMTP relay must support authenticated TLS 1.2 or newer. Port 465 may use
implicit TLS (`SMTP_SECURE=true`); submission ports such as 587 use mandatory
STARTTLS (`SMTP_SECURE=false`). The client always sets `requireTLS`, validates
the relay certificate, and fails delivery if encryption cannot be negotiated.

## Partner webhook destinations

`PARTNER_WEBHOOK_ALLOWED_HOSTS` is a comma-separated exact/wildcard hostname
allowlist. Wildcards must be used only for organization-controlled, non-delegated
subdomains. DNS is resolved once, prohibited networks are rejected, and the
validated public address is pinned into the TLS connection. Egress firewall
rules must independently deny private, link-local, and cloud metadata networks.

## Acceptance evidence

For every provider, attach the provider/version, environment, test account,
contract owner, data residency, retry/idempotency semantics, timeout/SLA,
redacted request/response samples, negative-path results, reconciliation query,
alert owner, rollback or disable procedure, and evidence expiry date to the
release ticket. No checked-in placeholder value is activation evidence.
