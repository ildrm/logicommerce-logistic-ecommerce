# Webhooks

Webhook delivery is asynchronous through the outbox. Production endpoints require
HTTPS, HMAC signature, timestamp, event/delivery IDs, replay window, rotating
secrets, bounded retries, dead-letter state, payload redaction, and manual replay.
