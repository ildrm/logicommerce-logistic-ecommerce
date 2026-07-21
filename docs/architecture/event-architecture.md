# Event architecture

Business transactions write aggregate state and an `OutboxEvent` in one MySQL
transaction. The worker claims unpublished events, publishes them to the
appropriate queue/webhook pipeline, then records publication time. Consumers
deduplicate by event ID and version. Payloads minimize personal data.
