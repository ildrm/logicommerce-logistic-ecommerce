# Webhooks

Webhook delivery is asynchronous through the outbox. Production endpoints require
HTTPS, HMAC signature, timestamp, event/delivery IDs, replay window, rotating
secrets, bounded retries, dead-letter state, payload redaction, and manual replay.

Outbound partner delivery performs a real HTTPS POST. Production requires an
explicit exact or wildcard hostname allowlist. Before connecting, the API resolves
all addresses and rejects loopback, link-local, private, carrier-grade NAT,
documentation, benchmark, multicast, and reserved ranges. The selected public
address is pinned into the HTTPS connection while TLS SNI and certificate
verification continue to use the original hostname. Redirects are rejected,
responses are capped at 64 KiB, and delivery uses a bounded timeout. Leased
delivery rows make retries safe across replicas and end in durable dead-letter
state after the configured attempt limit.

Shop webhooks use tenant-managed HMAC secrets. Stripe and Coinbase payment
webhooks use their provider-specific signature contracts and preserve a durable
receipt before allocation. Provider event IDs are unique, stale or invalid
signatures are rejected, duplicate valid events are no-ops, and accounting
effects are compensating entries rather than edits. Checkout success pages are
informational only.
