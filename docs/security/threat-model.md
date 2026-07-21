# Initial threat model

Primary assets are tenant data, identities, inventory, orders, payout instructions,
provider credentials, and immutable evidence. Trust boundaries exist at public
ingress, browser/API sessions, integration credentials, queues, storage, and
operator approvals.

Highest-risk threats are cross-tenant access, account takeover, refund/payout
abuse, inventory manipulation, webhook forgery/replay, upload malware, secret
leakage, and privileged insider actions. Baseline controls include tenant-scoped
repositories, deny-by-default permissions, rotating hashed tokens, HMAC webhooks,
idempotency, rate limits, redacted structured logs, immutable audits, dual approval,
and adapter isolation. Security tests must exercise identifiers from another tenant
without revealing record existence.
