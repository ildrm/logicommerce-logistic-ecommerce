# @logicommerce/api-client

Typed API transport boundary. OpenAPI generation will replace handwritten route
methods as endpoint coverage expands; consumers never duplicate response types.

Freight, booking timeline, dispatch, invoice, and payment summaries consume the
shared contracts package; callers must not duplicate lifecycle-state strings.
