# Event architecture

Business transactions write aggregate state and an `OutboxEvent` in one MySQL
transaction. The worker claims unpublished events, publishes them to the
appropriate queue/webhook pipeline, then records publication time. Consumers
deduplicate by event ID and version. Payloads minimize personal data.

Transport milestones are the booking-level event projection used by the
customer journey timeline. Manual driver check-ins remain their own append-only
records and also create a milestone; proof of delivery creates the delivery
milestone. Payment providers have a separate durable receipt boundary:
signature verification and event-ID deduplication precede allocations,
finance journals, and booking unblocking.

Phase 13 adds three event histories with separate identity and ordering:

- handling events by handling unit and external key;
- insurance claim events by claim and occurrence time;
- postal events by item/receptacle/dispatch, standard, and provider external
  key.

The worker expires quotes/sessions, closes expired insurance coverage, detects
missed consolidation cutoffs and postal handovers, and emits durable outbox
signals. Replay must preserve the original external key; it must not create a
second physical or postal event.
