# Security boundaries

Public ingress terminates at the reverse proxy. The API validates configuration,
authentication, tenant scope, authorization, request shape, rate limits, and
idempotency before application services run. Database, cache, and object storage
are private network services in production. Provider secrets are references,
never domain data.
