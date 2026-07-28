# Freight, payment, and driver-coordination runbook

## Scope

This runbook covers Phase 12 freight requests, binding quotes, canonical
invoices, hosted payments, dispatch assignments, manual driver check-ins, and
proof of delivery. It does not authorize live GPS collection, cryptocurrency
custody, customs filing, or country-specific statutory e-invoicing.

## Activation sequence

1. Deploy migration `20260728055751_phase12_transport_billing` and run the seed
   twice. Confirm the `driver-coordinator` role has exactly the five transport
   permissions documented in the permission matrix.
2. Configure tenant billing identity, invoice currency, legal address, tax
   identifier, payment terms, credit limits, and the tenant freight feature
   flag.
3. Configure S3-compatible storage and verify quarantine, checksum, content
   type, maximum-size, signed upload, and signed download behavior.
4. In a non-production deployment, run the full journey with
   `PAYMENT_ADAPTER=mock`.
5. Set `PAYMENT_ADAPTER=stripe`, `coinbase`, or `multi` only after configuring
   provider secrets. Register the exact public webhook routes:
   `/api/v1/payments/webhooks/stripe` and
   `/api/v1/payments/webhooks/coinbase`.
6. Run provider sandbox checkout, duplicate webhook, stale signature, expiry,
   partial refund, reconciliation, and settlement-reference drills.
7. Enable the tenant feature flag only after backup/restore and rollback
   evidence is attached to the release record.

Production startup intentionally fails when `PAYMENT_ADAPTER=mock`.

## Operations queues

- `/operations/freight`: review submitted demand, recalculate a non-binding
  estimate, publish a binding quote revision, and plan ordered transport legs.
- `/operations/dispatch`: manage internal/subcontracted road resources, assign
  drivers and vehicles, start trips, and record manual calls or messages.
- `/operations/billing`: inspect canonical receivables, allocations, payment
  state, refunds, and credit notes.
- `/dashboard`: prioritize review backlog, expiring quotes, delayed legs,
  carrier exceptions, stale check-ins, failed payments, and overdue balances.

Sea, air, and rail legs use carrier references and operator milestones. Driver
and vehicle assignment is valid only for road legs. `GPS` is reserved and is
not an accepted check-in source.

## Payment incident response

1. Do not mark an invoice paid from a browser redirect. Provider-signed
   webhooks are authoritative.
2. Preserve the durable `PaymentEvent` receipt, provider event identifier,
   payload hash, session reference, invoice number, and correlation ID.
3. For a missing webhook, poll the non-terminal provider session and compare it
   with the provider dashboard. Do not synthesize a success event.
4. Replay the provider event only after signature and timestamp validation.
   Duplicate provider event IDs must remain no-ops.
5. Confirm the allocation equals the provider-confirmed amount and that the
   provider-clearing debit equals the accounts-receivable credit.
6. If an incorrect allocation posted, issue a provider refund and compensating
   journal/credit note. Never edit a posted journal or published invoice.

## Stale driver check-in response

The worker opens one `CHECK_IN_OVERDUE` exception when an in-transit assignment
passes `nextCheckInAt`. The coordinator should:

1. contact the driver or carrier using an approved channel;
2. record outcome, location text, reported time, optional coordinates, ETA,
   notes, exception code, and next contact time;
3. escalate `NO_ANSWER`, `DELAY`, or `EXCEPTION` according to the tenant SOP;
4. verify that a valid new check-in closes the overdue exception.

A location check-in cannot deliver or complete a booking. Operations must
record proof-of-delivery evidence, complete all legs, and then complete the
booking.

## Recovery and retention

- Restore the database and object store to the same recovery point; invoice and
  POD metadata without their objects is incomplete recovery.
- Retain immutable quote revisions, invoices, payment events, allocations,
  refunds, credit notes, journals, check-ins, milestones, exceptions, audit,
  and outbox evidence according to tenant policy and legal hold.
- Driver phone ciphertext and contact-bearing documents require restricted
  access. Signed object links should be short-lived and must not be written to
  logs.
