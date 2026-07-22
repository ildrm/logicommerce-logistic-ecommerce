# Continuation guide

This is the canonical handoff for the next developer or coding agent. It
records what was built, what was verified, which constraints are intentional,
and where implementation must resume.

Last updated: **2026-07-22**.

## Current project state

LogiCommerce is a production-oriented modular-monolith foundation for a
multi-tenant C2C, B2C, B2B, dropshipping, and 1PL–5PL platform.

- Phase 0, repository and platform foundation, is `TESTED`.
- Phase 1, tenancy, identity, and authorization, is `IN_PROGRESS`.
- Phases 2–11 are not complete. Some contain reusable packages or design
  boundaries, but that does not satisfy their definitions of done.
- The visual control-tower prototype under `mockups/control-tower` is a design
  reference, not the production application.

Always check [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md) before
describing a module as implemented.

## First 30 minutes after cloning

### 1. Check prerequisites

- Docker Desktop or a compatible Docker Engine with Compose v2.
- Node.js 24 LTS. The repository intentionally rejects Node 26 through its
  engine range because the selected ecosystem was verified on Node 24.
- Corepack and pnpm 11.15.1.

### 2. Install and generate

```bash
corepack enable
corepack prepare pnpm@11.15.1 --activate
pnpm install --frozen-lockfile
pnpm db:generate
```

### 3. Start the development stack

```bash
cp .env.example .env
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose run --rm migrate pnpm db:seed
docker compose ps -a
```

Expected state:

- `web`, `api`, `worker`, `mysql`, `redis`, `minio`, `mailpit`, and
  `reverse-proxy` are healthy.
- `migrate` exits with status 0; it is a one-shot job, not a daemon.

### 4. Exercise the known-good vertical slice

```bash
curl -fsS http://localhost:8080/api/v1/health/ready
curl -fsS \
  -H 'x-tenant-id: 00000000-0000-4000-8000-000000000001' \
  http://localhost:8080/api/v1/tenants/current
pnpm test:auth:live
```

The second command should return the `platform-demo` tenant. In development,
the middleware also defaults to this demo tenant when the header is omitted.
Production must never infer a tenant this way.
The live authentication command creates only local test sessions, revokes all
of them before exit, and verifies login, refresh reuse (including a concurrent
race), tenant mismatch, session revocation, logout, and logout-all.

### 5. Run the repository gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
docker compose -f compose.yaml -f compose.dev.yaml config --quiet
docker compose -f compose.yaml -f compose.prod.yaml config --quiet
```

If a local Next.js Turbopack build fails only with `binding to a port` and
`Operation not permitted`, check the execution sandbox. The same build passed
when allowed to create Turbopack's internal process and in the Docker build.

## Local endpoints

| Surface         | URL                                         |
| --------------- | ------------------------------------------- |
| Web application | `http://localhost:8080`                     |
| Platform status | `http://localhost:8080/platform`            |
| REST base       | `http://localhost:8080/api/v1`              |
| Swagger UI      | `http://localhost:8080/api/docs`            |
| API readiness   | `http://localhost:8080/api/v1/health/ready` |
| Mailpit         | `http://localhost:8025`                     |
| MinIO console   | `http://localhost:9001`                     |

Mailpit, MinIO, MySQL, and Redis host ports are supplied by
`compose.dev.yaml`. The production topology keeps data services internal.

## Demo data

The seed is idempotent and currently creates:

- Tenant ID: `00000000-0000-4000-8000-000000000001`
- Tenant slug: `platform-demo`
- User: `admin@demo.logicommerce.local`
- Local-only password: `ChangeMe-Local-Only-2026`
- Role: `tenant-admin`
- Permission: `tenant.configure`
- Isolation tenant ID: `00000000-0000-4000-8000-000000000009`
- Isolation tenant slug: `isolation-test` (no login identity)

The password is Argon2-hashed in the database. Local API login is implemented;
the browser sign-in and session-management UI is not.

## What has been implemented

### Repository and delivery foundation

- pnpm workspace and Turborepo task graph.
- Exact dependency versions and committed lockfile.
- Shared TypeScript, ESLint, Prettier, and editor configuration.
- Next.js App Router web application with responsive foundation screens.
- NestJS API on Fastify with URI versioning, Swagger, validation, CORS,
  security headers, request IDs, and Problem Details errors.
- Nest application-context worker with an outbox polling lifecycle and health
  marker.
- Multi-stage, non-root Docker images with pruned production dependencies.
- Docker Compose topology for MySQL, Redis, MinIO, Mailpit, migration, API,
  worker, web, and Nginx.
- Development and production Compose overlays.
- CI workflow for install, generation, lint, typecheck, test, build, and
  Compose validation.

### Database foundation

The committed migration and Prisma schema currently cover:

- tenants and tenant domains;
- users, identities, sessions, and refresh tokens;
- roles, permissions, role grants, and user-role assignments;
- inventory items, derived balances, immutable stock-ledger entries, and
  reservations;
- append-only audit events;
- transactional outbox events;
- idempotency records.

The schema is a foundation, not a complete catalog, order, WMS, TMS, or finance
model. Expand it through new committed migrations; do not rewrite the existing
foundation migration after it has been shared.

### Shared packages

| Package                          | Responsibility                         |
| -------------------------------- | -------------------------------------- |
| `@logicommerce/api-contracts`    | Public DTO and response contracts      |
| `@logicommerce/api-client`       | Typed client boundary                  |
| `@logicommerce/config`           | Fail-fast environment parsing          |
| `@logicommerce/database`         | Prisma client and tenant-scope helpers |
| `@logicommerce/domain-events`    | Versioned event envelopes              |
| `@logicommerce/logistics-engine` | Deterministic stock and routing rules  |
| `@logicommerce/observability`    | Structured logging and redaction       |
| `@logicommerce/ui`               | Shared UI tokens and components        |
| `@logicommerce/validation`       | Shared input validation primitives     |

## Architecture invariants

Preserve these unless an accepted ADR changes them:

1. Start as a modular monolith. Web, API, and worker deploy independently, but
   business modules remain in one repository and one primary database.
2. Controllers call application services; application services call repository
   or port interfaces. Do not place Prisma queries in controllers.
3. Every tenant-owned table carries `tenantId`, and tenant-owned repository
   operations accept resolved tenant context. Root `Tenant` lookup scopes by
   `id`, not a nonexistent `tenantId` field.
4. The request tenant comes from a verified identity, API credential, or trusted
   host mapping. `x-tenant-id` is only a development bridge.
5. Cross-module asynchronous work uses a transactional outbox. Do not publish
   an event before the state transaction commits.
6. Inventory and finance are ledgers. Corrections use compensating entries;
   posted history is not updated in place.
7. Mutating public APIs must address idempotency and optimistic concurrency.
8. Raw payment instruments never enter this system. Use licensed provider
   tokens and webhooks.
9. Data services stay on internal container networks in production.
10. Mock adapters must be labeled as mocks in code, documentation, and UI.

## Known implementation lessons

- NestJS 11 wildcard middleware routes require a named wildcard such as
  `{*path}`. The tenant middleware is registered globally in `TenancyModule`.
- URI versioning and the global prefix produce `/api/v1/...`; health checks and
  reverse-proxy paths must use the same prefix.
- The worker's polling timer must remain referenced or Node exits successfully.
  Poll errors are caught and logged so a temporary database outage does not
  terminate the worker.
- The root `Tenant` model is tenant-scoped by `id`; child models are normally
  scoped by `tenantId`. The database helper supports both keys.
- Prisma Client is generated under `packages/database/generated` and is ignored
  by Git. Run `pnpm db:generate` after install or schema changes.
- Dockerfiles separate package manifests from source and use a BuildKit pnpm
  cache. Keep new workspace `package.json` files in all three Dockerfile manifest
  copy lists until the build is refactored to a dedicated pruning stage.
- `vitest run --dir src` is used for the database package so compiled tests in
  `dist` are not executed a second time.

## Exact next implementation slice: finish Phase 1

The narrow local authentication backend is implemented and unit tested. It
includes password verification, access and rotating refresh tokens, refresh
reuse detection, authenticated actor context, session revocation, and auth
audit events. It is live-tested against MySQL through
`pnpm test:auth:live`, including simultaneous refresh reuse and a second-tenant
token mismatch. Do not begin Phase 2 until the Phase 1 exit criteria in the
roadmap are met.

Completed in the 2026-07-22 slice:

1. Authentication application services and Prisma-isolated repositories.
2. Seeded Argon2 email/password login with generic credential failures.
3. Short-lived tenant/session-bound access tokens and opaque, hashed refresh
   tokens in hardened browser cookies.
4. Atomic refresh rotation, consumed-token reuse detection, and token-family
   and session revocation.
5. Current-user, session listing, revoke-one, logout, and logout-all endpoints.
6. Authenticated actor context plus active-session validation on protected auth
   endpoints.
7. Authentication audit events for login success/failure, refresh reuse,
   logout, and session revocation.
8. Idempotent second-tenant seed fixture and a repeatable live authentication
   integration command covering login, rotation/reuse, concurrent refresh,
   tenant mismatch, session revocation, logout, and logout-all.
9. Redis-backed, hashed-key login and refresh rate limits with configurable
   windows and fail-closed behavior when Redis is unavailable.
10. Verified hostname/domain tenant resolution; production ignores an
    untrusted tenant header while local development retains an explicit bridge.
11. Reusable deny-by-default permission declarations and guards, with
    `tenants/current` protected by `tenant.configure`.
12. A read-only viewer fixture plus live admin-allow/viewer-deny coverage and a
    persisted `auth.permission.denied` audit event.
13. Raw Fastify middleware/error-filter compatibility and tenant-free health and
    Swagger infrastructure paths, including the exact Docker health probe.

Continue in this order:

1. Run the live authentication integration command in CI with an isolated
   database, and add direct automated assertions for audit persistence and
   non-enumerating cross-tenant resource lookups.
2. Add role, permission, grant, and user-role administration APIs with
   deny-by-default permissions, tenant isolation, and role-change audits.
3. Add Playwright login/logout coverage and accessible sign-in,
   session-management, loading, empty, and error UI.
4. Implement password reset and email verification using single-use, hashed,
   expiring tokens and the mock-mail adapter.
5. Implement TOTP MFA, recovery codes, MFA-aware sessions, and pluggable
   OIDC/social provider boundaries.
6. Add auth/tenant metrics and complete the Phase 1 exit-scenario evidence.

ADRs still required as their decisions become active: Redis queue semantics,
object-storage upload/security model, full authentication model, tenant
isolation enforcement, Shop API authentication, and search abstraction. Do not
write speculative ADRs merely to fill the list; record the decision with its
real constraints before implementing the affected phase.

Suggested initial endpoints:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId
GET    /api/v1/auth/me
```

Do not return refresh tokens in JSON when using the browser flow; use an
`HttpOnly`, `Secure`, `SameSite` cookie and CSRF protection appropriate to the
selected origin model.

## Pull-request workflow

For each domain slice:

1. Update or add the domain document and business rules.
2. Add schema and a new migration if persistence changes.
3. Add authorization and tenant-isolation rules before controllers.
4. Implement validation, Problem Details errors, idempotency, audit, and logs.
5. Add unit, integration, and critical E2E tests.
6. Run all repository gates.
7. Update `IMPLEMENTATION_STATUS.md`, the verification record, and the
   changelog with evidence.

Use conventional commits and short-lived branches. Keep phase completion and
module completion separate: one finished endpoint does not complete a phase.

## When a phase may move to TESTED

A phase is not `TESTED` until its functional requirements, business rules,
schema, migrations, permissions, tenant isolation, audit behavior, validation,
error handling, idempotency, responsive UI states, accessibility checks, unit
tests, integration tests, critical E2E paths, logs, metrics, and documentation
are present and passing.

## Open decisions that require owner input

Do not guess the launch jurisdictions, merchant/seller/importer of record,
payment and settlement provider, tax and identity providers, data residency,
retention, C2C buyer protection, B2B credit policy, contracted warehouse and
carrier integrations, secrets manager, observability vendor, or production
orchestration target. Track these in [open-decisions.md](../open-decisions.md).

The final product journeys A–I are preserved in
[acceptance-scenarios.md](../product/acceptance-scenarios.md). They are future
acceptance criteria, not current test results.

## Handoff checklist

Before handing the repository to another developer:

- ensure the branch contains migrations and the lockfile;
- run the gates and record the exact results;
- ensure `.env` and generated Prisma code are not committed;
- document mocks and external dependencies;
- update phase status conservatively;
- record new architectural choices as ADRs;
- leave the next smallest vertical slice clearly identified.
