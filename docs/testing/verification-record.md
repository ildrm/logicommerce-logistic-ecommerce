# Verification record

This file records commands that actually ran. It is not a substitute for CI and
must be updated with new evidence when behavior changes.

## Phase 8 through 11 completion — 2026-07-23

### Environment

- Docker Desktop with MySQL 8.4, Redis 8.2, pinned Node.js 24 validation and
  production images, and k6 0.57.0.
- Host Node.js 26.5.0 executed dependency-free live and Playwright commands;
  authoritative repository gates used Node.js 24.
- Migration `202607230005_phase8_phase11_platform` applied successfully and the
  permission, chart-of-accounts, SLO, and retention seed completed.

### Repository and runtime gates

| Gate                      | Result | Evidence summary                                                  |
| ------------------------- | ------ | ----------------------------------------------------------------- |
| Formatting                | Passed | All Prettier-managed files matched                                |
| Full lint                 | Passed | 18/18 tasks with concurrency bounded to two                       |
| Full typecheck            | Passed | 18/18 tasks                                                       |
| Full unit suite           | Passed | 18/18 tasks; API 7 files and 18 tests                             |
| Production builds         | Passed | API, worker, web, and migration images built                      |
| Migration and seed        | Passed | Migration 5/5; database up to date                                |
| Live Phase 8–11           | Passed | Reverse logistics/finance, 3PL/4PL, 5PL, and operability          |
| Earlier-phase regressions | Passed | Phase 1, Phase 2/3 concurrency, and Phase 4–7                     |
| Desktop/mobile Playwright | Passed | Chromium and Pixel 7 projects, 8/8                                |
| k6 control-plane load     | Passed | 25 VUs, 48,685 iterations, 0% failures                            |
| Runtime health            | Passed | API, web, worker, proxy, MySQL, Redis, MinIO, and Mailpit healthy |

The k6 run measured median 21.17 ms, p95 72.24 ms, and 0 failed requests. The
configured p50 50 ms, p95 150 ms, p99 400 ms, and failure-rate thresholds all
passed.

### Exit evidence

- Phase 8 completed RMA request, approval, deterministic reverse label, receipt,
  inspection, restock, refund journal, seller-payable capture, balanced journal
  assertion, settlement calculation, approval, and payout. Cross-tenant bearer
  use was denied.
- Phase 9 created a 3PL client, contract, isolated inventory allocation,
  billable event, and invoice. A primary-facility exception produced an
  alternative; execution before approval failed, then a separate approval
  enabled an audited pre-pick facility transfer.
- Phase 10 created a versioned network model and ran identical frozen inputs
  twice. Both returned the same run and output hash. The recommendation was
  approved, executed, measured against forecast, and rolled back.
- Phase 11 recorded an SLO observation, a recovery exercise evaluated against
  15-minute RPO and 60-minute RTO, retention with legal hold, a hashed-subject
  privacy request, and bounded request metrics.
- The Phase 2/3 concurrency regression again returned exactly one `201` and one
  `409` without negative inventory. Phase 4–7 and Phase 1 live suites passed
  unchanged.

### Defects corrected during validation

1. The generated migration attempted to remove database-level tenant foreign
   keys maintained outside Prisma relation declarations. Those drops were
   removed and all new tables received tenant foreign keys.
2. A settlement query attached an account relation include to return lines; it
   was moved to journal lines.
3. Journal reversal was made one typed, atomic transaction instead of a
   post-create update.

### External evidence boundary

An attempted local dependency audit was not run because it would disclose the
repository dependency inventory to an external audit service without separate
authorization. CI contains source/container scanning and CycloneDX SBOM gates;
an authorized CI result, measured coverage report, external penetration test,
and production-provider restore exercise remain release evidence rather than
local claims.

## Phase 4 through 7 completion — 2026-07-23

### Environment

- Docker Desktop with MySQL 8.4, Redis 8.2, and pinned Node.js 24 build,
  migration, and validation images.
- Host Node.js 26.5.0 executed dependency-free live scripts only; authoritative
  repository gates used Node.js 24.
- Migration `202607230004_phase4_phase7_network` applied successfully and the
  permission/warehouse seed completed.

### Repository and runtime gates

| Gate                       | Result | Evidence summary                                  |
| -------------------------- | ------ | ------------------------------------------------- |
| Formatting                 | Passed | All Prettier-managed files matched                |
| Full lint                  | Passed | 18/18 tasks with concurrency bounded to two       |
| Full typecheck             | Passed | 18/18 tasks                                       |
| Full unit suite            | Passed | 18/18 tasks; API 6 files and 16 tests             |
| Container production build | Passed | API, worker, web, and migration images built      |
| Migration and seed         | Passed | Forward migration and idempotent seed completed   |
| Live Phase 4–7 acceptance  | Passed | Four exit journeys completed in sequence          |
| Live regressions           | Passed | Phase 1 authentication and Phase 2/3 commerce     |
| Desktop/mobile Playwright  | Passed | Chromium and mobile projects, 8/8 tests           |
| Runtime health             | Passed | API, web, worker, proxy, MySQL, and Redis healthy |

### Exit evidence

- Phase 4 received and inspected an ASN into the immutable stock ledger, put
  accepted units away, created fulfillment from an accepted split, and picked,
  packed, labeled, manifested, dispatched, and tracked the shipment to
  delivery. The isolation tenant could not enumerate the tracking record.
- Phase 5 verified a seller, moderated a used listing, negotiated and accepted
  an offer, recorded shipment evidence and buyer receipt, released the payout,
  and created a review.
- Phase 6 applied contract pricing, negotiated an RFQ/quote, enforced approval
  and PO policy, recorded partial then complete fulfillment, and issued the
  payment-terms invoice.
- Phase 7 issued a scoped/rate-limited partner credential, read catalog and
  inventory, submitted the same external order twice with one result, fulfilled
  it, signed outbound webhook deliveries, accepted a verified inbound event
  exactly once, and rotated/revoked the credential.
- The responsive `/operations` evidence surface passed at desktop and mobile
  widths.

### Defects corrected during validation

1. Strict Prisma optional/JSON inputs were normalized instead of passing
   explicit `undefined`.
2. API declarations were prevented from leaking generated Prisma internal
   types.
3. A global response boundary converts persisted `BigInt` values to JSON-safe
   numbers.
4. Webhook accepted and fulfilled events now receive distinct domain event
   UUIDs; all subscribed endpoints still share the same ID for one event.
5. Repository lint was rerun with bounded concurrency after Docker killed an
   over-parallelized task without an ESLint diagnostic.

## Phase 2 and 3 completion — 2026-07-23

### Environment

- Docker Desktop with MySQL 8.4, Redis 8.2, and Node.js 24 application and
  validation images.
- Host Node.js 26.5.0 remained outside the supported range; authoritative
  repository gates used the pinned Node 24 image.
- Migration `202607230003_phase2_phase3_commerce` applied and the expanded
  idempotent seed completed.

### Repository and runtime gates

| Gate                       | Result | Evidence summary                                           |
| -------------------------- | ------ | ---------------------------------------------------------- |
| Formatting                 | Passed | All Prettier-managed files matched                         |
| Full lint                  | Passed | 18/18 tasks with concurrency bounded to protect Docker     |
| Full typecheck             | Passed | 18/18 tasks                                                |
| Full unit suite            | Passed | 18/18 tasks; API 6 files and 16 tests                      |
| Container production build | Passed | API, worker, web, and migration images built               |
| Live Phase 2/3 acceptance  | Passed | Catalog-to-confirmed-dropship-order journey                |
| Inventory concurrency      | Passed | One `201`, one `409`, and no negative balance              |
| Desktop/mobile Playwright  | Passed | Chromium and Pixel 7 projects, 6/6 tests                   |
| Phase 1 live regression    | Passed | Authentication and authorization suite after commerce work |

### Phase 2 and 3 exit evidence

- A store domain was configured, a supplier submission was created and
  submitted, a merchant approved it, and a seller offer was published.
- An idempotent absolute inventory feed created one unit; replay returned the
  original result without an extra ledger movement.
- Public MySQL-backed search found the approved product through the replaceable
  catalog search port without tenant leakage.
- A percentage promotion affected the deterministic tax/shipping cart quote.
- Two independently authenticated customers checked out the only unit
  concurrently. Exactly one returned `201`; the other returned retryable
  inventory-unavailable `409`.
- Reusing the winning checkout idempotency key returned the original order.
- Checkout moved the unit from on-hand to reserved, created one seller/supplier
  split and dropship purchase order, and wrote audit and outbox records.
- Purchase-order acceptance moved the unit from reserved to allocated and
  confirmed the order.
- Reconciliation reported the tested item balanced at `ON_HAND=0`,
  `RESERVED=0`, and `ALLOCATED=1`; every balance remained non-negative.
- A tenant-B lookup for the tenant-A order did not return the order or disclose
  its number.
- Storefront browser tests passed browse, availability, search, loading, and
  empty states at desktop and Pixel 7 sizes.

### Defects corrected during completion

1. Prisma/MySQL serializable deadlocks (`P2034`) are translated into the
   contract's retryable `409` response instead of leaking as HTTP 500.
2. Purchase-order response mapping converts all money values from `BigInt`
   before JSON serialization.
3. Reservation expiry now produces compensating reserved/on-hand ledger
   movements and an outbox event.
4. The local MySQL adapter allows RSA public-key retrieval outside production
   so connection pools recover after a MySQL restart; production remains
   expected to use configured TLS/key material.
5. Resource-heavy repository gates are documented and verified with bounded
   concurrency to avoid starving the local database container.

### Production adapter boundary

Address validation, tax, shipping, fraud, and payment implementations are
deterministic development adapters. They contain no raw payment instrument
handling and are not claims of production provider integration.

## Phase 1 completion — 2026-07-23

### Environment

- Docker Desktop with Compose v5.3.0.
- Node.js 24 and pnpm 11.15.1 inside the validation/application images.
- Host Node.js 26.5.0 remained outside the supported range, so authoritative
  repository gates ran in the pinned Node 24 image.

### Repository and runtime gates

| Gate                           | Result | Evidence summary                                                    |
| ------------------------------ | ------ | ------------------------------------------------------------------- |
| Formatting                     | Passed | All Prettier-managed files matched                                  |
| Full lint                      | Passed | 18/18 tasks after dependency declarations were built                |
| Full typecheck                 | Passed | 18/18 tasks                                                         |
| Full unit suite                | Passed | 18/18 tasks; API 6 files and 16 tests                               |
| Production build               | Passed | 12/12 tasks; API, worker, and Next.js account route built           |
| Development/production Compose | Passed | Both `config --quiet` commands exited 0                             |
| Migration status               | Passed | Two migrations found; schema up to date                             |
| Live Phase 1 integration       | Passed | MySQL/Redis identity, authorization, MFA, token, and audit scenario |
| Desktop/mobile Playwright      | Passed | Chromium and Pixel 7 projects, 4/4 tests                            |

### Phase 1 exit evidence

- A tenant administrator listed roles, created a tenant-admin user, enrolled
  TOTP, confirmed it, and received eight one-time recovery codes.
- Login without MFA was rejected; a recovery code worked once and replay was
  rejected.
- A role was created and granted `tenant.configure`; desktop and mobile browser
  tests also created a role and saved its grant through the account UI.
- Active sessions were listed and another session was revoked.
- A second-tenant identity lookup returned 401 without exposing whether a
  resource existed.
- Verification, reset, and passwordless requests returned generic responses.
  Development delivery previews supplied test tokens; consumption succeeded
  once and replay failed.
- Password reset revoked active sessions, rejected the old password, and
  accepted the rotated password with MFA.
- A machine credential was returned once at creation, listed without its
  secret, authenticated on a `tenant.configure` scope-protected endpoint, and
  returned 401 after revocation. Its secret is persisted only as an HMAC hash.
- Direct local database inspection found `IdentityToken`, `MfaCredential`,
  `MfaRecoveryCode`, and `ApiCredential` records plus
  `auth.mfa.enrollment-started`, `auth.mfa.enabled`,
  `identity.credential.created`, `identity.credential.revoked`,
  `identity.role.created`, `identity.role.permissions-changed`, and
  `identity.user.created` audit events.
- The append-only `202607220002_phase1_identity` migration and idempotent
  permission seed applied successfully.

### Defects corrected during completion

1. Empty POST requests no longer send a JSON content type, avoiding Fastify's
   correct empty-JSON rejection in both the live helper and account UI.
2. Clean-checkout type-aware lint now builds workspace dependency declarations
   first instead of depending on ignored local `dist/` artifacts.
3. Parallel desktop/mobile browser fixtures use project-unique role keys and
   role-section-scoped locators.
4. The Phase 1 CI job now provisions the stack, seeds it, runs the live suite,
   resets test-only rate counters, installs Chromium, and runs responsive E2E
   tests. This workflow change is configured locally; the hosted CI run remains
   the repository host's responsibility.

### Production adapter boundary

The included mail delivery adapter is intentionally development-only and fails
closed in production. OIDC/social support is a provider-neutral port and
registry, not a claim that an unselected external vendor is integrated.

## Phase 1 authentication and authorization boundary — 2026-07-22

### Environment

- Local host Node.js: 26.5.0, which is outside the supported Node 24 range and
  produced the expected engine warning.
- pnpm 11.15.1 through Corepack.
- Docker Desktop with Compose v2 and Node 24 inside application images.

### Repository gates

| Gate                       | Result | Evidence summary                                       |
| -------------------------- | ------ | ------------------------------------------------------ |
| Focused API tests          | Passed | 6 files, 16 tests                                      |
| Full lint                  | Passed | 12 successful tasks                                    |
| Full typecheck             | Passed | 18 successful tasks                                    |
| Full unit suite            | Passed | 18 successful tasks; API has 16 tests                  |
| Production build           | Passed | API/worker packages and Next.js production build       |
| Live auth integration      | Passed | Tenancy, permission, rate-limit, and refresh-race flow |
| Playwright                 | Passed | Chromium and Pixel 7, 2/2 foundation tests             |
| Formatting and whitespace  | Passed | Changed source/docs and `git diff --check`             |
| Development Compose config | Passed | `config --quiet` exited 0                              |
| Production Compose config  | Passed | `config --quiet` exited 0                              |

The first production build attempt hit the documented sandbox-only Turbopack
`binding to a port` restriction. The identical build passed when allowed to
create Turbopack's internal process.

### Container and live HTTP evidence

- API and migration images rebuilt with the direct Argon2 runtime dependency.
- The foundation migration reported no pending migrations and the updated
  idempotent seed completed successfully.
- API, web, worker, reverse proxy, MySQL, Redis, MinIO, and Mailpit were healthy;
  the one-shot migration container exited 0.
- Live login and `me` returned 200; tenant-mismatched bearer use returned 401.
- Refresh rotation returned 200; sequential reuse, replacement-family use, and
  the revoked session returned 401.
- Two simultaneous refreshes produced exactly one 200 and one 401. The winning
  replacement token and access-token session were then both rejected with 401.
- Invalid login returned 401 without setting a cookie.
- Login resolved the tenant from verified `localhost` without a tenant header;
  the production middleware test proves a supplied header is ignored.
- The admin received 200 from the permission-protected tenant endpoint; the
  read-only viewer received 403.
- Ten invalid login attempts returned 401 and the next request returned 429
  through the Redis-backed limiter.
- Revoke-other-session, logout, and logout-all returned 204; affected bearer
  tokens were rejected afterward.
- Persisted evidence showed 64-character session and refresh-token hashes, no
  active test sessions, and audit rows for login success/failure, refresh reuse,
  session revocation, logout, logout-all, and one
  `auth.permission.denied` viewer event.
- The exact API Docker health URL returned 200 after tenant middleware was
  corrected to use the middleware adapter's preserved `originalUrl`.

### Behaviors covered by unit evidence

- Access-token signature, tenant/session claims, expiration, and tamper
  rejection.
- Opaque refresh-token hashing and hardened cookie attributes.
- Email normalization, generic invalid-credential handling, hashed session
  persistence inputs, IPv4 prefix masking, and login audits.
- Refresh-token reuse rejection and audit behavior.
- Password hashes are explicitly projected out of authentication responses.
- Auth rate-limit keys are SHA-256 hashes and Redis failures reject requests;
  raw email/IP values are not placed in keys.
- Permission declarations require every named permission, deny missing or
  undeclared privileged access, and record denied-action audits.
- Trusted-host middleware resolves verified active tenant domains, ignores the
  development bridge in production, and bypasses only health/Swagger paths.

### Remaining verification boundary

- Wire `pnpm test:auth:live` into an isolated CI database lifecycle and add
  direct automated database assertions for the audit rows currently checked by
  SQL during handoff.
- Add non-enumerating cross-tenant resource tests, role-administration audit
  assertions, and browser login/logout journeys with the pending UI.

## Foundation handoff — 2026-07-21

### Environment

- Container runtime: Docker Desktop with Compose v2.
- Container Node.js: 24 LTS.
- Local package manager: pnpm 11.15.1 through Corepack.
- Local host Node.js: 26.5.0, which correctly produced an engine warning because
  the supported repository range is Node 24.

### Repository gates

| Gate                       | Result | Evidence summary                                     |
| -------------------------- | ------ | ---------------------------------------------------- |
| `pnpm lint`                | Passed | 12 successful tasks                                  |
| `pnpm typecheck`           | Passed | 18 successful tasks                                  |
| `pnpm test`                | Passed | All unit suites passed                               |
| `pnpm build`               | Passed | 12 successful tasks; Next production build completed |
| `pnpm test:e2e`            | Passed | Chromium and Pixel 7 projects, 2/2 tests             |
| Development Compose config | Passed | `config --quiet` exited 0                            |
| Production Compose config  | Passed | `config --quiet` exited 0                            |
| `git diff --check`         | Passed | No whitespace errors                                 |

The database package was rerun after restricting Vitest to its source directory:
one test file and three tenant-scope tests passed without executing compiled
tests from `dist`.

### Container build and runtime

The following images built successfully:

- `logicommerce-web`
- `logicommerce-api`
- `logicommerce-worker`
- `logicommerce-migrate`

The final observed runtime state was:

- API healthy;
- web healthy;
- worker healthy and remained running;
- reverse proxy healthy;
- MySQL healthy;
- Redis healthy;
- MinIO healthy;
- Mailpit healthy;
- migration exited 0 with no pending migrations.

### Migration and seed

- Foundation migration `202607210001_foundation` applied successfully.
- A subsequent deploy reported no pending migrations.
- The idempotent Prisma seed completed successfully.

### Live HTTP smoke checks

These paths returned successful responses through Nginx:

```text
GET /                         -> 200
GET /healthz                  -> 200
GET /api/docs                 -> 200
GET /api/v1/health/live       -> 200
GET /api/v1/health/ready      -> 200
GET /api/v1/tenants/current   -> seeded tenant response
```

The tenant request used:

```text
x-tenant-id: 00000000-0000-4000-8000-000000000001
```

### Defects found and corrected during runtime validation

1. Added direct `class-validator` and `class-transformer` API dependencies.
2. Added the Fastify static plugin required by Swagger UI.
3. Aligned the API Docker health probe with `/api/v1/health/live`.
4. Added the global `/api` prefix to match proxy and public client URLs.
5. Registered tenant middleware and updated its NestJS wildcard syntax.
6. Added root-tenant scoping by `id` while preserving `tenantId` scoping for
   child models.
7. Kept the worker timer referenced so the process does not exit.
8. Caught outbox polling errors so temporary database outages are retried.
9. Pruned API and worker runtime dependency closures with `pnpm deploy`.
10. Added Docker manifest/source layer separation and BuildKit pnpm caching.

### Static-analysis triage

The senior-fullstack pattern analyzer reported six security candidates. Manual
review identified matches in Prisma-generated code and the `%s` Next metadata
title template; none represented an application secret or SQL injection path.
See [static-analysis.md](../security/static-analysis.md).

The analyzer's low estimated coverage remains a valid warning. It is not a
measured coverage report, and broad domain coverage remains Phase 11 work.

## 2026-07-23 operational analytics and UI verification

- Built the production API image with the tenant-scoped analytics aggregation
  endpoint and built the production Next.js image with `/dashboard`.
- Activated both images in the Compose stack; API, web, reverse proxy, MySQL,
  Redis, worker, MinIO, and Mailpit remained healthy.
- Ran focused Vitest coverage for API and web sources: 7 files, 18 tests, all
  passed.
- Ran the updated product-surface regression with an installed headless Chrome:
  10/10 tests passed serially across desktop Chromium and Pixel 7.
- Ran the final cross-domain dashboard scenario separately at desktop and
  mobile sizes: 2/2 passed.
- Browser coverage authenticated as the local admin and verified live analytics,
  reporting-window URL state, accessible chart/table evidence, dashboard
  responsive order, storefront browse/search/empty states, platform readiness,
  identity controls, shared navigation, and absence of roadmap terminology.
- The final runs reported no page errors or console errors. Visual comparison
  against the accepted dashboard concept corrected an SVG series-fill defect
  before the passing regression.

## How to add a new verification entry

Record the date, commit SHA, environment, exact commands, results, relevant
scenario inputs, and any defects corrected. Never convert an expected or
planned test into a passing result without running it.
