# Security policy

Report vulnerabilities privately to the project security owner. Do not open a
public issue containing exploit details, credentials, or customer data.

The repository must never contain production secrets. Development credentials
are placeholders and local-only. See `docs/security/threat-model.md` for the
initial model and `docs/security/permission-matrix.md` for authorization rules.

Raw card details, wallet secrets, and private keys must never enter
LogiCommerce. Payment completion is accepted only from verified, replay-safe
provider webhooks. Driver phone numbers are encrypted at rest; signed document
URLs, freight contacts, coordinates, invoice PDFs, and proof-of-delivery
evidence must not be logged. Cross-tenant resource lookups return
non-enumerating errors.
