# Initial threat model

Primary assets are tenant data, identities, inventory, orders, payout instructions,
provider credentials, freight contacts and coordinates, cargo/customs/POD
documents, invoices, payment events, and immutable evidence. Trust boundaries
exist at public ingress, browser/API sessions, integration credentials, payment
webhooks, queues, storage, and operator approvals.

Highest-risk threats are cross-tenant access, account takeover, refund/payout
abuse, inventory manipulation, webhook forgery/replay, upload malware, secret
leakage, and privileged insider actions. Baseline controls include tenant-scoped
repositories, deny-by-default permissions, rotating hashed tokens, HMAC webhooks,
idempotency, rate limits, redacted structured logs, immutable audits, dual approval,
and adapter isolation. Security tests must exercise identifiers from another tenant
without revealing record existence.

Phase 12 additionally guards against forged or replayed provider success,
checkout-return spoofing, cross-tenant invoice/POD download, malicious uploads,
driver-contact disclosure, fabricated GPS claims, duplicate milestones, credit
limit bypass, and refund/allocation imbalance. Payment events require raw-body
signature verification and durable event-ID deduplication; driver phones are
field-encrypted; signed object links are short-lived. An active malware scanner,
production SMTP, and GPS provider are not currently bundled.
