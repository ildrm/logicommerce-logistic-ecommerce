# LogiCommerce

LogiCommerce is a multi-tenant commerce and logistics platform for C2C, B2C,
B2B, dropshipping, and 1PL–5PL operating models. The repository starts as a
modular monolith with separately runnable web, API, and worker processes.

> **Current state:** Phases 0–7 are tested. This is a working
> identity-secured commerce and network-operations core, not a completed
> returns, finance, 3PL–5PL, or hardening program. New
> contributors should begin with the
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

The reverse proxy is the normal application entry point. MySQL, Redis, and
MinIO API ports are exposed only in the development override.

The idempotent seed creates tenant `platform-demo`, local-only admin
`admin@demo.logicommerce.local`, read-only viewer
`viewer@demo.logicommerce.local`, and an `isolation-test` tenant without a login
identity. Both demo users use `ChangeMe-Local-Only-2026`. The Phase 1 API
supports local and passwordless login, email verification/reset, token
rotation, session revocation, TOTP/recovery MFA, trusted-host tenant resolution,
Redis rate limiting, deny-by-default permissions, tenant role/user
administration, and scoped machine credentials. The responsive account UI is
available at `http://localhost:8080/account`.

## Local development

Node.js 24 LTS and pnpm 11 are supported.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:network:live
```

See the [documentation map](docs/README.md),
[continuation guide](docs/development/continuation-guide.md),
[implementation status](IMPLEMENTATION_STATUS.md), and
[phase roadmap](docs/product/phase-roadmap.md).

## Continue implementation

Phases 0–11 have repository-level automated evidence. Preserve the tested
tenancy, ledger, idempotency, approval, and webhook invariants while selecting
production providers and obtaining authorized CI security/SBOM, measured
coverage, penetration-test, and provider restore evidence.

## Repository layout

- `apps/web` — Next.js storefront and role-aware operational surfaces.
- `apps/api` — NestJS/Fastify REST API and OpenAPI documentation.
- `apps/worker` — background jobs and transactional-outbox publication.
- `packages/*` — contracts, database, configuration, domain events, UI, and
  deterministic logistics rules.
- `infrastructure` — reverse proxy and operational configuration.
- `tests` — cross-application and performance test foundations.
- `mockups/control-tower` — retained visual design reference.

External payment, tax, identity-verification, and carrier providers are not
presented as production integrations. Development uses deterministic adapter
boundaries until credentials and contracts are selected.

The [verification record](docs/testing/verification-record.md) contains the
commands and live checks that passed at the foundation handoff. Update it only
with tests that actually ran.
