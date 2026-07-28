# Security boundaries

Public ingress terminates at the reverse proxy. The API validates configuration,
authentication, tenant scope, authorization, request shape, rate limits, and
idempotency before application services run. Database, cache, and object storage
are private network services in production. Provider secrets are references,
never domain data.

Payment webhooks retain the exact raw request bytes long enough to verify the
provider signature, then persist a redacted durable receipt. Raw card data,
wallet secrets, and private keys never cross the provider boundary. Driver
phones are field-encrypted; object upload/download URLs are short-lived; freight
contacts, coordinates, invoice documents, and proof evidence are sensitive.
The `driver-coordinator` role is restricted to four dispatch/check-in
permissions.
