# Module boundaries

NestJS domain modules expose application services and ports. Controllers call
application services only; Prisma access is isolated behind repositories.
Cross-domain state changes use versioned domain events and the transactional
outbox. Direct imports across package internals are prohibited by public exports.

Implemented boundaries include identity/tenancy, catalog, commerce,
fulfillment, C2C, B2B, partner APIs, reverse logistics/finance, 3PL–5PL,
operability/analytics, freight/dispatch, canonical billing, and payment
providers. Freight owns requests, quotes, bookings, legs, milestones, fleet,
assignments, check-ins, exceptions, and proof of delivery. Billing owns
canonical invoices, schedules, sessions, provider receipts, allocations,
refunds, credit notes, and document rendering.

The international-logistics module owns governed locations/code lists,
transport parties and consignments, transport/customs documents, insurance
catalog/policies/claims, hubs, handling units and custody events,
consolidation/shared linehaul, and postal exchange objects. It references an
eligible freight booking and cargo item but does not replace freight's
commercial request/booking ownership. Payment remains owned by billing;
billing activates the referenced cargo-insurance policy after the premium
invoice is fully paid.

Freight may request invoice creation through the billing service but does not
post provider payments itself. Billing may unblock the associated booking after
the required schedule is paid but does not mutate freight movement history.
