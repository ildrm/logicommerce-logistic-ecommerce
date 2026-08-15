# LogiCommerce

LogiCommerce is a multi-tenant commerce and logistics platform for C2C, B2C,
B2B, dropshipping, and 1PL–5PL operating models. The repository starts as a
modular monolith with separately runnable web, API, and worker processes.

> **Current state:** Phases 0–13 are implemented with repository-level automated
> evidence. Production builds now fail closed unless external commerce, carrier,
> identity-verification, C2C escrow, malware-scanning, payment, SMTP, and webhook
> controls are configured. Provider activation and external release evidence remain
> deployment work. New contributors should begin with the
> [continuation guide](docs/development/continuation-guide.md).

## Quick start

```bash
cp .env.example .env
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose run --rm migrate pnpm db:seed
```

Local endpoints:

| Service                      | URL                            |
| ---------------------------- | ------------------------------ |
| Storefront and operations UI | http://localhost:8080          |
| API                          | http://localhost:8080/api/v1   |
| Swagger                      | http://localhost:8080/api/docs |
| Mailpit                      | http://localhost:8025          |
| MinIO console                | http://localhost:9001          |

Primary product workspaces are `/dashboard`, `/freight`, `/storefront`,
`/account`, `/operations`, `/operations/freight`, `/operations/dispatch`, and
`/operations/billing`.

Freight bookings expose a chronological travel-and-event timeline in
`/freight`. It is built from recorded transport milestones, manual driver
check-ins, and proof-of-delivery events; it is not continuous GPS tracking. See
the [freight journey timeline](docs/logistics/freight-journey-timeline.md).

The reverse proxy is the normal application entry point. MySQL, Redis, and
MinIO API ports are exposed only in the development override.

The idempotent seed creates tenant `platform-demo`, local-only admin
`admin@demo.logicommerce.local`, customer test account
`viewer@demo.logicommerce.local`, and an `isolation-test` tenant without a login
identity. Both demo users use `ChangeMe-Local-Only-2026`. The Phase 1 API
supports local and passwordless login, email verification/reset, token
rotation, session revocation, TOTP/recovery MFA, trusted-host tenant resolution,
Redis rate limiting, deny-by-default permissions, tenant role/user
administration, tenant-controlled customer registration, and scoped machine
credentials. The responsive account UI is available at
`http://localhost:8080/account`; the seeded demo tenant permits registration.

## Local development

Node.js 24 LTS and pnpm 11 are supported.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:network:live
pnpm test:phase12:live
```

See the [documentation map](docs/README.md),
[continuation guide](docs/development/continuation-guide.md),
[implementation status](IMPLEMENTATION_STATUS.md), and
[phase roadmap](docs/product/phase-roadmap.md). The
[documentation audit](docs/testing/documentation-audit-2026-07-28.md) records
the current documentation review boundary.

## Continue implementation

Phases 0–13 have repository-level automated evidence. Phase 13 adds the
international logistics structure required for consignments, transport and
customs documents, cargo insurance/claims, hubs and consolidation, physical
handling units, shared linehaul, and postal exchange. Preserve the tested
tenancy, ledger, idempotency, approval, and webhook invariants while selecting
regional production providers and obtaining Stripe/Coinbase sandbox,
authorized CI security/SBOM, measured coverage, penetration-test, and provider
restore evidence.

## Repository layout

- `apps/web` — Next.js storefront and role-aware operational surfaces.
- `apps/api` — NestJS/Fastify REST API and OpenAPI documentation.
- `apps/worker` — background jobs and transactional-outbox publication.
- `packages/*` — contracts, database, configuration, domain events, UI, and
  deterministic logistics rules.
- `infrastructure` — reverse proxy and operational configuration.
- `tests` — cross-application and performance test foundations.
- `mockups/control-tower` — retained visual design reference.

The [international logistics audit](docs/product/international-logistics-system-audit.md)
lists the transportation, logistics, postal, and product findings and their
disposition. The [international standards map](docs/logistics/international-standards-map.md)
explains alignment and the external certification boundary.

Stripe Checkout and Coinbase Business Checkout adapters are implemented but
are inactive without deployment secrets and sandbox certification. Local mock
and deterministic adapters are development/test-only; production startup rejects
them. Commerce, carrier, identity-verification, C2C escrow, document-scanner, and
SMTP adapters have production HTTP/SMTP implementations and still require
contracted providers, credentials, sandbox certification, and deployment evidence.

The [verification record](docs/testing/verification-record.md) contains the
commands and live checks that passed at the foundation handoff. Update it only
with tests that actually ran.
