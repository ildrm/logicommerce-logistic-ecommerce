# Repository Audit — 2026-08-16

## Scope and operating model

This review covered the pnpm/Turborepo workspace, Next.js web application,
NestJS API and worker, Prisma/MySQL persistence, Redis coordination, MinIO
storage, Nginx ingress, Docker/CI/release paths, tests, and product and
operations documentation. The system is a tenant-scoped modular monolith with
transactional outbox processing and immutable inventory/accounting ledgers.

“Corrected” below means the defect was changed and covered by the strongest
available local gate. It does not claim that no undiscovered defect exists.

## Findings corrected

| Area              | Finding                                                                                                                              | Resolution                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product flow      | C2C/B2C documentation began with a person registering, but no customer registration path or customer role existed.                   | Added opt-in tenant self-registration, a customer role/permissions, session issuance, UI, rate limiting, audit, and acceptance coverage.                            |
| Payments          | Coinbase endpoints, refund response parsing, webhook authentication, and event identity reflected an obsolete contract.              | Implemented the current Business API paths, sandbox selection, strict signature input, UUIDv4 idempotency, nested refunds, and transition-safe event IDs.           |
| Payments          | Stripe delayed payment methods could never complete.                                                                                 | Added asynchronous success/failure event handling.                                                                                                                  |
| Webhooks          | Signed malformed JSON could surface as an internal error; payment failure could regress completed state.                             | Return a client error for invalid JSON and only fail pending payments.                                                                                              |
| Billing           | Refunds and credit notes did not fully reconcile invoice totals, schedules, allocations, or journals.                                | Added credited balances, aggregate credit limits, schedule allocation/reopening, async refund reconciliation, audit/outbox events, and balanced accounting entries. |
| Numeric integrity | Money and quantities were repeatedly converted from `BigInt` to JavaScript `number`, risking silent precision loss.                  | Use exact integer arithmetic, checked conversion helpers, a request pipe, safe response serialization, and string event quantities.                                 |
| Configuration     | App-local startup could miss the root environment; CORS/proxy trust and Redis URL validation were too permissive.                    | Added deterministic environment discovery, normalized strict origins, private-proxy trust, and `redis`/`rediss` validation.                                         |
| Data access       | Runtime database configuration reconstructed a URL instead of honoring Prisma's canonical `DATABASE_URL`.                            | Reuse the validated canonical URL.                                                                                                                                  |
| Operability       | Readiness ignored Redis; worker startup failures could escape, TLS Redis was unsupported, and its health file polluted the checkout. | Probe both dependencies, retry safely, support TLS, and write health state to the OS temporary directory.                                                           |
| Web delivery      | The production web image omitted `public`, one image was missing, and the platform docs link was machine-specific.                   | Copy public assets, add a fallback product image, and use a repository-relative link.                                                                               |
| Supply chain      | A transitive `nanoid` version had a high-severity advisory.                                                                          | Override the affected range to the patched release; the production audit is clean.                                                                                  |
| Portability       | Mixed line endings broke formatting on Windows and generated TypeScript build state was tracked.                                     | Define LF normalization, ignore/remove the cache, and keep formatter output reproducible.                                                                           |
| Assurance         | The “domain-critical” coverage gate sampled only three small helpers.                                                                | Expand it to numeric and webhook trust boundaries; it now passes at 98.87% lines and 86.58% branches.                                                               |

## Open release gaps

These are not safely solvable by repository code alone:

- Whole-API unit coverage is 12.50% lines. The live journeys are broad, but
  service/repository failure-path tests should be expanded before production.
- Stripe and Coinbase need deployment-specific sandbox certification, webhook
  reachability and reconciliation drills, and real account credentials.
- Tax, address, fraud, carrier/WMS, email/OIDC, KYC/escrow, malware scanning,
  insurance, customs, postal, sanctions, dangerous-goods, and GS1 capabilities
  require selected providers, contracts, licensed data, or legal review.
- Continuous GPS and a unified quote/payment/travel timeline remain explicit
  product decisions, not advertised implemented features.
- External penetration/regulatory review, an authorized CI scan/SBOM run, and a
  production-provider backup/restore exercise remain go-live evidence.
- Docker-backed migrations and journeys could not be rerun in this review
  because the local Docker Desktop WSL engine failed to boot. Static gates,
  unit/coverage tests, production builds, and Compose rendering passed.
