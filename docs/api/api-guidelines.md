# API guidelines

REST endpoints use `/api/v1`, UUID identifiers, JSON, cursor or page pagination,
request/correlation IDs, explicit authorization, and problem-details responses.
Create and transition operations require `Idempotency-Key`. Stack traces and
record-existence details for unauthorized cross-tenant access are never returned.

Freight request, quote, booking, dispatch, billing, and payment contracts use
the shared state enums in `@logicommerce/api-contracts`. Booking reads return
legs in sequence order and milestones in occurrence order. Manual check-ins and
provider milestones require stable external event identifiers where replay is
possible.

Payment webhook routes are the intentional exception to normal authenticated
tenant resolution: the provider reference resolves the tenant only after raw
body signature and timestamp verification. Browser redirects never mark an
invoice paid.
