# Implementation status

Last evidence update: **2026-07-21**. See the
[verification record](docs/testing/verification-record.md) for commands and
runtime results, and the
[continuation guide](docs/development/continuation-guide.md) for the exact next
implementation slice.

Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTED`, `DOCUMENTED`.

| Phase                                    | Status      | Evidence / current boundary                                                                                                                                         | Next required outcome                                                                                                                                |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Repository and platform foundation    | TESTED      | Monorepo, pinned dependencies, apps, packages, Docker images, migration, seed, CI workflow, documentation, unit/E2E tests, and live health paths validated.         | Maintain gates and documentation while later phases extend the foundation.                                                                           |
| 1. Tenancy, identity, authorization      | IN_PROGRESS | Tenant/identity/session/RBAC schema exists. Tenant middleware, AsyncLocalStorage context, tenant-safe root lookup, Argon2 seed, and current-tenant smoke path work. | Password login, token rotation/reuse detection, authenticated context, permission guards, audit, session UI, MFA, and two-tenant isolation evidence. |
| 2. Stores, catalog, offers, storefront   | NOT_STARTED | Domain documents and UI/package foundations only.                                                                                                                   | Supplier product submission through merchant approval, offer publication, search, and storefront discovery.                                          |
| 3. Inventory, cart, checkout, B2C orders | NOT_STARTED | Inventory schema primitives and deterministic invariant package exist; no checkout/order journey.                                                                   | Concurrency-safe reservation and complete B2C dropshipping flow.                                                                                     |
| 4. Fulfillment, WMS, TMS, tracking       | NOT_STARTED | Deterministic routing boundary only.                                                                                                                                | ASN-to-delivery warehouse and carrier journey.                                                                                                       |
| 5. C2C                                   | NOT_STARTED | Business boundary documented only.                                                                                                                                  | Moderated listing, negotiation, shipment, buyer protection, payout eligibility, and reviews.                                                         |
| 6. B2B                                   | NOT_STARTED | Business boundary documented only.                                                                                                                                  | Contract pricing, RFQ/quote, approvals, PO, terms, partial fulfillment, and invoice.                                                                 |
| 7. Seller, supplier, Shop APIs           | NOT_STARTED | API conventions, webhook guidance, and typed-client foundation only.                                                                                                | Scoped credentials, idempotent order API, signed webhooks, and partner portals.                                                                      |
| 8. Returns, finance, settlements         | NOT_STARTED | Ledger ADR only.                                                                                                                                                    | Reverse-logistics flow and balanced immutable financial/settlement journals.                                                                         |
| 9. 3PL and 4PL maturity                  | NOT_STARTED | Control-tower prototype retained only as a UX reference.                                                                                                            | Multi-client 3PL operations and audited human-approved 4PL rerouting.                                                                                |
| 10. 5PL foundation                       | NOT_STARTED | Deterministic logistics-rule package only; no validated optimizer.                                                                                                  | Versioned, reproducible, explainable recommendations with human approval and outcome measurement.                                                    |
| 11. Hardening                            | NOT_STARTED | Baseline CI, health checks, threat model, and static-analysis triage only.                                                                                          | Coverage, performance, accessibility, security, observability, backup/restore, DR, and final scenario evidence.                                      |

## Current focus

Finish Phase 1. The first vertical slice is documented under
[Exact next implementation slice](docs/development/continuation-guide.md#exact-next-implementation-slice-finish-phase-1).

## Phase 0 verification summary

- Lint: passed, 12 successful tasks.
- Typecheck: passed, 18 successful tasks.
- Unit suites: passed.
- Production build: passed, 12 successful tasks.
- Playwright: Chromium and Pixel 7, 2/2 passed.
- Development and production Compose configurations: valid.
- Migration and idempotent seed: passed.
- Web, API, worker, reverse proxy, MySQL, Redis, MinIO, and Mailpit: healthy.
- Swagger, API readiness, and seeded tenant lookup: live-smoke tested.

Nothing beyond the evidence above should be treated as production-complete.
