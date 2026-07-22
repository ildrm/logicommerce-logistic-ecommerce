# Verification record

This file records commands that actually ran. It is not a substitute for CI and
must be updated with new evidence when behavior changes.

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

## How to add a new verification entry

Record the date, commit SHA, environment, exact commands, results, relevant
scenario inputs, and any defects corrected. Never convert an expected or
planned test into a passing result without running it.
