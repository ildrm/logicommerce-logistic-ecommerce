# @logicommerce/observability

Structured logging with mandatory sensitive-field redaction. OpenTelemetry setup
will be added with the optional observability Compose profile.

Freight contacts, coordinates, document URLs, invoice PDFs, provider webhook
payloads/signatures, driver phones, and payment secrets are redaction targets.
The analytical dashboard uses bounded tenant aggregates rather than raw PII.
