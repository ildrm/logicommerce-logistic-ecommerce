# LogiCommerce

LogiCommerce is a multi-tenant commerce and logistics platform for C2C, B2C,
B2B, dropshipping, and 1PL–5PL operating models. The repository starts as a
modular monolith with separately runnable web, API, and worker processes.

> **Current state:** Phase 0 is tested and Phase 1 is in progress. This is a
> working platform foundation, not a completed commerce or 5PL product. New
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

The idempotent seed creates tenant `platform-demo` and local-only account
`admin@demo.logicommerce.local` / `ChangeMe-Local-Only-2026`. Authentication
endpoints and UI are still part of Phase 1, so this account currently supports
database and authorization development rather than an interactive sign-in.

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
```

See the [documentation map](docs/README.md),
[continuation guide](docs/development/continuation-guide.md),
[implementation status](IMPLEMENTATION_STATUS.md), and
[phase roadmap](docs/product/phase-roadmap.md).

## Continue implementation

The next deliverable is the Phase 1 local authentication vertical slice:
password login, access and rotating refresh tokens, session revocation,
authenticated tenant/actor context, permission guards, audit events, and
two-tenant isolation tests. The exact order and guardrails are documented in
the [continuation guide](docs/development/continuation-guide.md#exact-next-implementation-slice-finish-phase-1).

Do not start Phase 2 until Phase 1 satisfies the exit criteria in the
[phase roadmap](docs/product/phase-roadmap.md#phase-1--tenancy-identity-and-authorization).

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
