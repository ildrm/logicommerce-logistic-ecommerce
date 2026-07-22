# Changelog

All notable project changes are recorded here. The project follows Keep a
Changelog structure and will adopt semantic versioning when releases begin.

## Unreleased

### Added

- Continuation guide, documentation map, phase roadmap, and verification record.
- Phase 1 local authentication API with Argon2 password verification,
  short-lived access tokens, opaque rotating refresh tokens, reuse detection,
  authenticated actor context, session revocation, and auth audit events.
- Authentication/session API contracts and ADR 0007 documenting the initial
  same-origin browser session model.
- Idempotent second-tenant isolation fixture and repeatable live authentication
  integration command.
- Verified-domain tenant resolution with a development-only tenant-header
  bridge, Redis-backed login/refresh limits, and fail-closed Redis behavior.
- Deny-by-default permission decorator/guard, protected tenant configuration,
  denied-action audit events, and an unprivileged viewer fixture.
- Fastify-compatible raw middleware/error-filter handling and tenant-free
  infrastructure health/Swagger routing.

### Validated

- Authentication unit tests, full lint/typecheck/test gates, production build,
  formatting, whitespace checks, and development/production Compose config.
- Live MySQL authentication flows, concurrent refresh reuse, persisted token
  and audit invariants, trusted-host resolution, admin allow/viewer deny,
  Redis rate limiting, cross-tenant token rejection, healthy Docker probes, and
  desktop/mobile Playwright regression tests.

### Known limitations

- The live integration command is not yet wired into an isolated CI database
  lifecycle. Role administration, recovery/verification, MFA, identity-provider
  adapters, and browser authentication UI remain Phase 1 work.

## 0.1.0-foundation — 2026-07-21

### Added

- pnpm and Turborepo monorepo with web, API, and worker applications.
- Shared contracts, configuration, database, events, logistics, observability,
  UI, validation, and API-client packages.
- Next.js web foundation and platform-status page.
- NestJS/Fastify API with health, Swagger, validation, Problem Details, request
  IDs, security headers, and tenant context.
- Prisma/MySQL foundation schema, migration, and idempotent demo seed.
- Tenant, identity, session, role, permission, inventory-ledger, audit, outbox,
  and idempotency persistence primitives.
- Resilient outbox polling worker.
- Docker images and Compose topology for web, API, worker, migration, MySQL,
  Redis, MinIO, Mailpit, and Nginx.
- CI workflow, ADRs, security documents, business boundaries, and UX guidance.
- Unit and Playwright foundation tests.

### Validated

- Lint, typecheck, tests, production build, Compose configurations, migration,
  seed, container health, Swagger, tenant lookup, and desktop/mobile E2E smoke
  journeys.

### Known limitations

- Phase 1 authentication and authorization workflows are incomplete.
- Phases 2–11 and final end-to-end scenarios are not implemented.
- External payment, tax, identity, address, carrier, malware-scanning, and
  production observability integrations remain adapter requirements.
