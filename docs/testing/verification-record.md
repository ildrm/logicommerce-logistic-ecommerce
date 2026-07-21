# Verification record

This file records commands that actually ran. It is not a substitute for CI and
must be updated with new evidence when behavior changes.

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
