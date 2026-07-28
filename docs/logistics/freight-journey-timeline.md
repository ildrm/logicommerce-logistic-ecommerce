# Freight journey timeline

Last reviewed: **2026-07-28**.

## Implemented behavior

Every freight booking has ordered transport legs and a chronological collection
of `TransportMilestone` records. The customer `/freight` workspace displays
those milestones under **Bookings and movement**, ordered by `occurredAt`.
Booking API responses also include ordered legs, manual road-assignment
check-ins, operational exceptions, and proof-of-delivery evidence.

Timeline events can come from:

- operator-entered road, sea, air, or rail milestones;
- a manual driver check-in, recorded as `DRIVER_CHECK_IN`, `DELAY`, or
  `EXCEPTION`;
- proof of delivery, which records a `DELIVERED` milestone.

Each milestone can carry a code, description, location text, coordinates,
source, external event identifier, and occurrence time. Provider or operator
event identifiers are used to make repeated ingestion idempotent.

## What the timeline proves

The timeline is an append-oriented operational history of reported movement
and delivery events. A check-in can update ETA and surface a delay, but it
cannot complete a leg or booking. Delivery requires proof-of-delivery evidence.
For road movements without GPS, the seeded `driver-coordinator` records phone,
SMS, WhatsApp, carrier-portal, or manual check-ins. Sea, air, and rail movements
use carrier references and operator-entered milestones.

## Current boundaries

- There is no continuous GPS feed, breadcrumb trail, or automatic browser
  geolocation.
- `GPS` is reserved for a future verified provider and is not an accepted
  current check-in source.
- The customer UI renders booking milestones; assignment check-ins,
  exceptions, and proof documents are returned as related booking evidence but
  are not merged with quote, invoice, payment, and exception-resolution events
  into one universal end-to-end timeline.
- Coordinates are optional and the current customer workspace does not claim a
  live map.

These boundaries must remain explicit until a provider-backed GPS integration
and a unified lifecycle-event projection are implemented and tested.
