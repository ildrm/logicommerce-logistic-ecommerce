# Webhooks

Webhook delivery is asynchronous through the outbox. Production endpoints require
HTTPS, HMAC signature, timestamp, event/delivery IDs, replay window, rotating
secrets, bounded retries, dead-letter state, payload redaction, and manual replay.

Shop webhooks use tenant-managed HMAC secrets. Stripe and Coinbase payment
webhooks use their provider-specific signature contracts and preserve a durable
receipt before allocation. Provider event IDs are unique, stale or invalid
signatures are rejected, duplicate valid events are no-ops, and accounting
effects are compensating entries rather than edits. Checkout success pages are
informational only.
