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
- Append-only identity migration for hashed verification/reset/passwordless
  tokens, encrypted TOTP credentials, single-use recovery codes, and hashed
  scoped machine credentials.
- TOTP enrollment and confirmation, MFA/recovery login challenges, replay
  prevention, and one-time recovery-code disclosure.
- Non-enumerating email verification, password reset, and passwordless login
  workflows with a labeled development mail adapter and production adapter
  boundary.
- Tenant-scoped role, permission-grant, user-role, and machine-credential
  administration APIs with session invalidation, scope enforcement, and audit
  events.
- Provider-neutral OIDC/social identity adapter port and registry.
- Responsive account UI for login, reset requests, sessions, MFA, tenant role
  grants, user creation, and role assignment.
- Isolated CI execution of the live Phase 1 suite and Chromium desktop/mobile
  browser journeys.
- Clean-checkout Turborepo lint ordering that builds workspace dependency
  declarations before type-aware consumer lint.
- Append-only Phase 2/3 commerce migration covering stores/domains, taxonomy,
  attributes, partners, submissions, products, variants, media, translations,
  offers, promotions, carts, addresses, orders, splits, and dropship purchase
  orders.
- Tenant-scoped catalog administration, supplier submission and merchant
  approval, seller offer publication, and a replaceable MySQL search adapter.
- Responsive storefront browse/search and authenticated cart, quote, address,
  checkout, customer-order, operations-order, and purchase-order APIs.
- Idempotent inventory feeds, non-negative atomic reservation, immutable stock
  movements, expiry release worker, allocation, and reconciliation.
- Deterministic development address, tax, shipping, fraud, and payment ports.
- Live Phase 2/3 acceptance suite with one-unit concurrent checkout and
  cross-tenant non-enumeration.
- Append-only Phase 4–7 migration for facilities, ASN receiving, fulfillment,
  shipments/tracking, C2C marketplace protection, B2B procurement/invoicing,
  partner credentials, Shop orders, and webhook delivery/receipt evidence.
- Warehouse, C2C, B2B, and partner API modules with deterministic
  identity-verification/carrier adapters and explicit state transitions.
- Scoped, rotatable, rate-limited Shop API credentials; idempotent external
  orders; encrypted webhook secrets; HMAC signing; replay protection; retries,
  dead letters, and manual replay.
- Responsive Phase 4–7 operations evidence surface and live network acceptance
  suite.
- Append-only Phase 8–11 migration for reverse logistics, double-entry finance,
  settlements, 3PL clients/billing, 4PL decisions, versioned network models,
  deterministic recommendations/outcomes, SLOs, recovery, retention, and privacy.
- Guarded returns/finance, network-operations, optimization, and operability API
  modules with compensations, human approvals, rollback, and tenant isolation.
- Responsive Phase 4–11 operations surface, runbooks, evidence-backed hardening
  portfolio, bounded request metrics, hardened ingress, load specifications,
  CI security scanning, and CycloneDX SBOM generation.

### Validated

- Authentication unit tests, full lint/typecheck/test gates, production build,
  formatting, and development/production Compose config.
- Live MySQL authentication flows, concurrent refresh reuse, persisted token
  and audit invariants, trusted-host resolution, admin allow/viewer deny,
  Redis rate limiting, cross-tenant token rejection, healthy Docker probes, and
  desktop/mobile Playwright regression tests.
- Complete Phase 1 exit scenario: tenant-admin user creation, MFA enrollment,
  role/grant management, session revocation, non-enumerating second-tenant
  denial, verification/reset/passwordless flows, token/recovery replay
  rejection, and machine-credential lifecycle.
- Complete Phase 2 exit scenario: supplier submission, approval, offer
  publication, inventory availability, and storefront discovery.
- Complete Phase 3 exit scenario: promotion quote, concurrent checkout with
  exactly one winner, idempotent replay, dropship PO acceptance, allocation,
  reconciliation, and confirmed order.
- Complete Phase 4 exit scenario: ASN receipt and putaway through tracked
  delivery with tenant non-enumeration.
- Complete Phase 5 exit scenario: verified seller listing through negotiation,
  protected shipment, payout release, and review.
- Complete Phase 6 exit scenario: contract price and RFQ through controlled
  approval, partial fulfillment, and invoice.
- Complete Phase 7 exit scenario: scoped integration, idempotent Shop order,
  signed/verified webhooks, and credential rotation.
- Complete Phase 8 exit scenario: return authorization through disposition,
  balanced refund/capture journals, settlement approval, and payout.
- Complete Phase 9 exit scenario: isolated 3PL inventory/billing and approved
  control-tower rerouting with audit evidence.
- Complete Phase 10 exit scenario: reproducible frozen-input recommendations,
  approval, execution, measured outcome, and rollback.
- Phase 11 repository, browser, live, and 25-VU load gates; 48,685 iterations
  completed with 0% failures and p95 72.24 ms.

### Known limitations

- Concrete production email and OIDC/social providers are not bundled; the
  selected deployment must supply those adapters and secrets.
- Authorized CI scan/SBOM output, measured domain-critical coverage, external
  penetration testing, and a production-provider restore exercise remain
  release evidence.

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
