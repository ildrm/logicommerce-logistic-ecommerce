# Continuation guide

This is the canonical handoff for the next developer or coding agent. It
records what was built, what was verified, which constraints are intentional,
and where implementation must resume.

Last updated: **2026-07-28**.

## Current project state

LogiCommerce is a production-oriented modular-monolith foundation for a
multi-tenant C2C, B2C, B2B, dropshipping, and 1PL–5PL platform.

- Phase 0, repository and platform foundation, is `TESTED`.
- Phase 1, tenancy, identity, and authorization, is `TESTED`.
- Phase 2, stores, catalog, offers, and storefront, is `TESTED`.
- Phase 3, inventory, cart, checkout, and B2C orders, is `TESTED`.
- Phases 4–7, fulfillment through partner APIs, are `TESTED`.
- Phases 8–11, returns/finance through hardening, are `TESTED` at the
  repository evidence boundary.
- Phase 12, global freight, canonical billing, hosted-payment adapters, and
  driver coordination, is `TESTED` locally.
- Phase 13, international consignments/documents/customs, cargo insurance,
  handling units, consolidation/shared linehaul, and postal exchange, is
  `TESTED` locally.
- The visual control-tower prototype under `mockups/control-tower` is a design
  reference, not the production application.
- Production provider activation, authorized external security evidence, SMTP,
  active malware scanning, reconciliation polling, and live GPS are not
  completed merely because ports or configuration fields exist.

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
pnpm test:commerce:live
pnpm test:network:live
pnpm test:phase12:live
pnpm test:phase13:live
pnpm test:e2e
```

The second command should return the `platform-demo` tenant. In development,
the middleware also defaults to this demo tenant when the header is omitted.
Production must never infer a tenant this way.
The live commands create local test users and records. Authentication coverage
verifies login, refresh reuse (including a concurrent race), tenant mismatch,
session revocation, MFA/recovery, role/grant administration, machine
credentials, verification/reset/passwordless flows, token replay rejection,
logout, and logout-all. Commerce coverage includes catalog approval, inventory,
one-unit checkout concurrency, dropship PO acceptance, reconciliation, and
cross-tenant denial. The E2E command covers desktop and mobile account,
role-administration, storefront, dashboard, freight, dispatch, and billing
journeys. The Phase 12 live command covers request-to-POD, canonical invoice,
mock prepayment, manual phone check-in, replay prevention, and tenant/
permission denial.
The Phase 13 command covers cargo-insurance premium activation and claims,
transport parties/documents/customs, handling-unit custody, hub
consolidation/capacity/VGM, postal item/receptacle/dispatch/consignment events,
tenant denial, permission denial, and analytical signals. Run the
authentication suite separately or clear only the disposable local Redis test
cache before later live suites, because its final scenario deliberately
exhausts the authentication rate limit.

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

| Surface               | URL                                          |
| --------------------- | -------------------------------------------- |
| Web application       | `http://localhost:8080`                      |
| Command dashboard     | `http://localhost:8080/dashboard`            |
| Customer freight      | `http://localhost:8080/freight`              |
| Freight operations    | `http://localhost:8080/operations/freight`   |
| Dispatch operations   | `http://localhost:8080/operations/dispatch`  |
| Billing operations    | `http://localhost:8080/operations/billing`   |
| International network | `http://localhost:8080/operations/network`   |
| Insurance operations  | `http://localhost:8080/operations/insurance` |
| Postal operations     | `http://localhost:8080/operations/postal`    |
| Customer postal       | `http://localhost:8080/postal`               |
| Platform status       | `http://localhost:8080/platform`             |
| REST base             | `http://localhost:8080/api/v1`               |
| Swagger UI            | `http://localhost:8080/api/docs`             |
| API readiness         | `http://localhost:8080/api/v1/health/ready`  |
| Mailpit               | `http://localhost:8025`                      |
| MinIO console         | `http://localhost:9001`                      |

Mailpit, MinIO, MySQL, and Redis host ports are supplied by
`compose.dev.yaml`. The production topology keeps data services internal.

## Demo data

The seed is idempotent and currently creates:

- Tenant ID: `00000000-0000-4000-8000-000000000001`
- Tenant slug: `platform-demo`
- User: `admin@demo.logicommerce.local`
- Local-only password: `ChangeMe-Local-Only-2026`
- Role: `tenant-admin`
- Role: `tenant-admin`, with the complete seeded administration and domain
  permission set defined in `packages/database/prisma/seed.ts`
- Role: `driver-coordinator`, restricted to
  `transport.dispatch.read`, `transport.assignment.manage`,
  `transport.checkin.write`, and `transport.exception.manage`
- Roles: `hub-operator`, `postal-operator`, and `insurance-adjuster`, each
  restricted to its international operational duties
- Rotterdam and Singapore international locations and gateway hubs, a demo
  ICC-A-style multimodal cargo-insurance product, and a demo postal operator
  and product
- Storefront: `demo-store`, with a category, attribute, approved product,
  active offer, promotion, and on-hand inventory
- Isolation tenant ID: `00000000-0000-4000-8000-000000000009`
- Isolation tenant slug: `isolation-test` (no login identity)

The password is Argon2id-hashed in the database. The browser identity center is
available at `/account`.

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

The Phase 1 append-only identity migration adds:

- hashed, expiring, single-use email verification, password reset, and
  passwordless login tokens;
- AES-256-GCM encrypted TOTP secrets and replay-step tracking;
- HMAC-hashed single-use recovery codes;
- HMAC-hashed, scoped, expirable, and revocable machine credentials.

Later append-only migrations add the tested WMS/TMS, C2C, B2B, partner,
returns/finance, 3PL–5PL, operability, freight, dispatch, canonical billing,
international consignment/document/customs, cargo insurance, handling,
consolidation/linehaul, and postal models. Published quotes, issued documents,
milestones, custody scans, postal events, claim events, check-ins, payment
receipts, finance journals, audit events, and outbox history are evidence
records; correct them through explicit transitions, supersession, or
compensation rather than rewriting history. Continue to use new committed
migrations.

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

### Tested identity boundary

- Trusted verified-domain tenant resolution with a development-only header
  bridge.
- Argon2id password login, short-lived tenant/session-bound access tokens,
  opaque rotating refresh tokens, reuse-family revocation, and active session
  checks.
- Session listing, revoke-one, logout, and logout-all.
- Redis-backed hashed-key login/refresh rate limits that fail closed.
- Deny-by-default permission declarations and tenant-scoped role, grant, user,
  user-role, and machine-credential administration.
- Email verification, password reset, and passwordless login through
  single-use hashed tokens and a labeled development mail adapter.
- TOTP enrollment/confirmation, encrypted secrets, replay prevention, and
  single-use recovery codes.
- Responsive account UI for sign-in, reset requests, sessions, MFA, role
  grants, user creation, and role assignment.
- Provider-neutral OIDC/social adapter port and registry. A concrete external
  provider is intentionally not selected in this repository.
- Security audit events and live non-enumerating cross-tenant checks.

### Tested commerce boundary

- Tenant-scoped store/domain configuration, catalog taxonomy and attributes,
  supplier submissions, merchant approval, products, variants, media,
  translations, seller offers, and a replaceable MySQL search adapter.
- Responsive storefront browse/search with loading, empty, error, product, and
  availability states.
- Idempotent absolute inventory feeds, derived balances, immutable ledger
  entries, reservations, expiry release, allocation, and reconciliation.
- Authenticated carts, promotions, quotes, validated addresses, deterministic
  development tax/shipping/fraud/payment adapters, and raw-token-free checkout.
- Serializable, idempotent checkout with atomic non-negative stock decrement,
  order splits, dropship purchase orders, supplier acceptance, and customer and
  operations order views.

### Tested logistics and marketplace boundary

- ASN receiving, inspection, putaway, fulfillment, pick/pack, shipment,
  normalized tracking, and delivery.
- Distinct C2C onboarding, listing, negotiation, buyer-protection, dispute,
  payout, and review policy.
- B2B accounts, contract prices, RFQ/quote approval, terms, partial
  fulfillment, and canonical invoice issuance.
- Scoped Shop credentials, idempotent orders, signed webhooks, retry,
  dead-letter, and replay evidence.
- Returns, balanced finance, settlements, 3PL billing, human-approved 4PL
  rerouting, and reproducible governed 5PL recommendations.

### Tested freight, billing, and coordination boundary

- Global road, sea, air, and rail requests with stops, cargo, documents,
  estimates, reviewed immutable quote revisions, booking, and ordered legs.
- Internal and subcontracted carrier/driver/vehicle dispatch for road legs,
  encrypted driver phones, manual check-ins, overdue exceptions, and proof of
  delivery.
- A chronological customer booking timeline backed by transport milestones.
  It is not continuous GPS and is not yet a unified
  quote/payment/travel/exception lifecycle feed.
- Canonical invoices and payment schedules, invoice PDF access, hosted Stripe
  and Coinbase adapters, signed idempotent webhooks, allocations, refunds,
  credit notes, and balanced provider-clearing journals.
- Functional customer, freight operations, dispatch, billing, and analytical
  dashboard workspaces.

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

## Exact next release slice: authorized production evidence

Phases 0–12 have repository-level automated evidence. Phase 12 migration
`20260728055751_phase12_transport_billing`, repeated seed, package gates,
production images, the local request-to-POD live journey, prior-phase
regressions, 12 desktop/mobile browser scenarios, tenant/permission isolation,
and provider signature/replay unit tests passed.

The next slice is provider and release evidence: run the CI security/container
scan and SBOM job in an authorized environment, produce measured
domain-critical coverage, commission an external penetration test, select
production telemetry/secrets/backup/orchestration providers, and execute a real
provider backup/restore drill against the documented RPO/RTO.

Also certify Stripe and Coinbase in provider sandboxes with deployment keys,
public webhook reachability, expiry/duplicate/refund/reconciliation drills, and
the tenant legal entity accepted by each provider. Production SMTP, active
malware scanning, provider-session reconciliation polling, and any future GPS
provider are separate implementation slices. Do not mutate posted inventory,
finance, audit, tracking, optimization, quote, payment-event, or webhook
history; use explicit transitions and compensating records.

ADRs still required as their decisions become active: Redis queue semantics,
object-storage upload/security model, tenant isolation enforcement, Shop API
authentication, and search abstraction. ADR 0007 records the active
authentication model. Do not write speculative ADRs merely to fill the list;
record each decision with its real constraints before implementing the affected
phase.

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

Product journeys A–J are preserved in
[acceptance-scenarios.md](../product/acceptance-scenarios.md). Repository-level
components and focused journeys have passed, but production-provider and
cross-domain end-to-end certification remain explicitly scoped there.

## Handoff checklist

Before handing the repository to another developer:

- ensure the branch contains migrations and the lockfile;
- run the gates and record the exact results;
- ensure `.env` and generated Prisma code are not committed;
- document mocks and external dependencies;
- update phase status conservatively;
- record new architectural choices as ADRs;
- leave the next smallest vertical slice clearly identified.
