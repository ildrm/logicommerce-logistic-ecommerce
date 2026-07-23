# Implementation status

Last evidence update: **2026-07-23**. See the
[verification record](docs/testing/verification-record.md) for commands and
runtime results, and the
[continuation guide](docs/development/continuation-guide.md) for the exact next
implementation slice.

Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTED`, `DOCUMENTED`.

| Phase                                    | Status | Evidence / current boundary                                                                                                                                                                                                                                                                                                                                                                                                     | Next required outcome                                                                                                                       |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Repository and platform foundation    | TESTED | Monorepo, pinned dependencies, apps, packages, Docker images, migration, seed, CI workflow, documentation, unit/E2E tests, and live health paths validated.                                                                                                                                                                                                                                                                     | Maintain gates and documentation while later phases extend the foundation.                                                                  |
| 1. Tenancy, identity, authorization      | TESTED | Trusted-domain tenant resolution; password, verification, reset, and passwordless flows; rotating sessions; TOTP/recovery MFA; tenant-scoped role, user, grant, and machine-credential administration; deny-by-default authorization; audit; accessible administration UI; and two-tenant non-enumeration are covered by unit, live MySQL/Redis, and desktop/mobile browser tests.                                              | Maintain provider ports and configure production email/OIDC/social adapters when vendors are selected.                                      |
| 2. Stores, catalog, offers, storefront   | TESTED | Tenant-scoped stores/domains, locale/currency/branding, taxonomy and attributes, suppliers/sellers, approval workflow, products/variants/media/translations/SEO, offer publication, a replaceable MySQL search adapter, availability, public browse/detail APIs, and responsive storefront loading/empty/error states. The live exit journey and cross-tenant denial pass.                                                      | Preserve sellable-product invariants while Phase 4 adds fulfillment; replace the MySQL search adapter only when scale evidence requires it. |
| 3. Inventory, cart, checkout, B2C orders | TESTED | Idempotent inventory feeds; derived balances and immutable ledger; expiring reservations and worker release; reconciliation; carts, promotions, deterministic tax/shipping/address/fraud/payment ports; idempotent transactional checkout; seller/supplier splits; orders; dropship POs; acceptance/allocation; and customer/operations views. A live one-unit race returns exactly one 201 and one 409 with no negative stock. | Begin Phase 4 from confirmed order splits and allocated inventory; replace deterministic provider adapters before production use.           |
| 4. Fulfillment, WMS, TMS, tracking       | TESTED | Tenant-scoped facilities/bins, ASN receiving and inspection, ledger-backed putaway, fulfillment orders, pick/pack, deterministic carrier rates and labels, manifest/dispatch, normalized tracking, customer tracking, and the responsive operations rail passed the live ASN-to-delivery journey and cross-tenant denial.                                                                                                       | Maintain ledger/state-machine invariants while Phase 8 introduces reverse logistics.                                                        |
| 5. C2C                                   | TESTED | Identity verification, seller profiles, used listings/media/condition, prohibited-goods screening, moderation, offers, buyer protection, shipment evidence, disputes, payout eligibility/release, and mutual reviews passed the live seller-to-review journey as a distinct policy boundary.                                                                                                                                    | Maintain the distinct C2C policy boundary while returns and settlement ledgers are added.                                                   |
| 6. B2B                                   | TESTED | Business accounts/members, spend and approval limits, contract prices, RFQs and quotes, PO references, payment terms, partial fulfillment, and invoice issuance passed the live RFQ-to-invoice journey.                                                                                                                                                                                                                         | Extend invoices and credit terms through balanced Phase 8 finance journals.                                                                 |
| 7. Seller, supplier, Shop APIs           | TESTED | Scoped credentials, IP policy, rotation, rate limits, catalog/inventory reads, idempotent orders, fulfillment, encrypted webhook secrets, HMAC signatures, replay windows, retries/dead letters, inbound receipts, and manual replay passed live. A discovered webhook event-identity collision was corrected and revalidated.                                                                                                  | Preserve compatibility and delivery evidence while later seller/finance/3PL surfaces expand.                                                |
| 8. Returns, finance, settlements         | TESTED | Tenant-scoped RMA request through disposition/restock/refund; immutable balanced journals and atomic reversals; chart of accounts, reconciliation, settlement reserves/adjustments/approval/payout passed the live journey and tenant denial.                                                                                                                                                                                   | Preserve compensation and posted-history invariants while production payment/settlement providers are selected.                             |
| 9. 3PL and 4PL maturity                  | TESTED | Logistics clients, versioned contracts/rate cards/SLA, isolated inventory allocation, single-use billing events/invoices, control-tower exceptions, deterministic alternatives, separate human approval, safe pre-pick facility transfer, and decision audit passed live.                                                                                                                                                       | Validate contracted warehouse/provider adapters and multi-site operating volumes before production.                                         |
| 10. 5PL foundation                       | TESTED | Versioned network models, frozen inputs/constraints/objectives, canonical hashes, deterministic feasible ranking, explicit non-optimality explanation, approval, execution, outcome variance, and rollback passed unit and live reproducibility tests.                                                                                                                                                                          | Calibrate and independently validate a solver/model before making any mathematical-optimality claim.                                        |
| 11. Hardening                            | TESTED | Metrics, SLO evidence, RPO/RTO evaluation, retention/legal hold, hashed-subject privacy, ingress limits/CSP/HSTS, responsive UI, runbooks, CI scan/SBOM gates, and hardening artifacts passed repository/browser/live/load validation. k6 passed 48,685 iterations at 25 VUs with 0% failures and p95 72.24 ms. External provider evidence remains explicit.                                                                    | Obtain authorized CI scan/SBOM results, measured coverage, external penetration evidence, and a production-provider restore exercise.       |

## Current focus

Phases 0–11 have repository-level automated evidence. The next work is
production-provider selection and authorized release evidence: CI security/SBOM,
measured domain-critical coverage, external penetration testing, and an actual
provider backup/restore drill.

## Operational analytics and product-surface update

- Added a tenant-scoped `GET /api/v1/analytics/overview?days=7|14|30` endpoint
  protected by `operability.read`.
- Added `/dashboard` as the authenticated command center for system health,
  order/fulfillment trends, prioritized exceptions, handoff health, inventory,
  finance, SLOs, optimization, governed activity, and cross-domain workload.
- Cross-domain activity covers identity, catalog, checkout, B2C, fulfillment,
  C2C, B2B, Shop APIs, returns, 3PL/4PL, optimization, and reliability even
  when no exception is active.
- The dashboard preserves the last good snapshot during refresh failure,
  distinguishes live/partial/stale states, polls every 60 seconds, exposes
  exact chart values as an accessible table, and uses URL-backed time windows.
- Reworked `/`, `/platform`, `/storefront`, `/account`, and `/operations` into
  a shared product shell with clear page responsibilities and responsive
  navigation.
- Removed development-phase and implementation-status terminology from all
  customer/operator-facing pages. A legacy SLO test fixture was renamed from
  phase terminology to `API availability`.
- Production API and web images compiled successfully; the focused unit run
  passed 18/18 tests; the updated browser regression passed 10/10 tests across
  desktop Chromium and Pixel 7; the final cross-domain dashboard check passed
  2/2 at desktop and mobile sizes with no browser console or page errors.

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

## Phase 1 verification summary

- Full lint: passed, 18 successful tasks after clean-checkout dependency builds.
- Full typecheck: passed, 18 successful tasks.
- Unit suites: passed, including 6 API files and 16 API tests.
- Production build: passed, 12 successful tasks.
- Live identity integration: passed against MySQL and Redis.
- Playwright: Chromium and Pixel 7, 4/4 passed.
- Append-only identity migration and idempotent permission seed: passed.
- Development and production Compose configurations: valid.
- CI workflow includes the isolated live identity and responsive browser
  scenarios.
- Production email and external OIDC/social implementations remain
  deployment adapters, not bundled vendor integrations.

## Phase 2 and 3 verification summary

- Append-only commerce migration applied and the expanded seed completed.
- Full unit suite passed: 18/18 Turborepo tasks and 16/16 API unit tests.
- Full lint and typecheck passed: 18/18 tasks each.
- Live commerce acceptance passed supplier submission, approval, offer
  publication, idempotent feed, promotion, storefront discovery, cart quote,
  concurrent checkout, idempotent replay, dropship PO acceptance, order
  confirmation, ledger reconciliation, and tenant non-enumeration.
- The one-unit race returned one `201` and one `409`; balances ended at
  `ON_HAND=0`, `RESERVED=0`, `ALLOCATED=1`.
- Playwright passed 6/6 Chromium and Pixel 7 scenarios, including storefront
  browse, search, and empty state.
- Live Phase 1 authentication regression passed after the commerce changes.
- API, worker, web, MySQL, Redis, and reverse proxy were healthy after rebuild.
- Address, tax, shipping, fraud, payment, and mail integrations remain clearly
  labeled deterministic development adapters pending vendor selection.

## Phase 4 through 7 verification summary

- Migration `202607230004_phase4_phase7_network` applied and the expanded
  permission/warehouse seed completed idempotently.
- Formatting, lint, typecheck, and unit gates passed; lint and typecheck each
  completed 18/18 tasks, and API unit coverage completed 16/16 tests.
- Production API, worker, web, and migration images built successfully.
- Live Phase 4 passed ASN receipt/inspection/putaway through pick, pack, label,
  manifest, dispatch, delivery tracking, and cross-tenant denial.
- Live Phase 5 passed verification, moderation, negotiation, shipment evidence,
  payout eligibility/release, and review.
- Live Phase 6 passed contract pricing, RFQ, quote, controlled approval, PO
  reference, partial fulfillment, completion, and invoice.
- Live Phase 7 passed scoped catalog/inventory access, idempotent Shop order
  replay, fulfillment, signed outbound delivery, verified inbound replay
  protection, and credential rotation/revocation.
- Phase 1 authentication and Phase 2/3 commerce live regressions passed.
- Playwright passed 8/8 Chromium and mobile scenarios, including `/operations`.

## Phase 8 through 11 verification summary

- Migration `202607230005_phase8_phase11_platform` applied, seeded, and reported
  database schema up to date at 5/5 migrations.
- Formatting passed; lint and typecheck passed 18/18 tasks; unit tests passed
  18/18 tasks with 18 API tests.
- API, worker, web, and migration production images built; all eight long-lived
  services were healthy.
- Live Phase 8–11 acceptance passed returns/finance, 3PL/4PL, deterministic 5PL,
  recovery/privacy/metrics, tenant denial, approval-before-execution, journal
  balance, reproducibility, outcome measurement, and rollback.
- Phase 1, Phase 2/3, and Phase 4–7 regressions passed. The inventory race again
  returned one `201` and one `409`.
- Playwright passed 8/8 Chromium/mobile tests including all Phase 4–11 operation
  rails.
- k6 passed 25 VUs for 60 seconds: 48,685 iterations, 0% failures, median
  21.17 ms, p95 72.24 ms, and all configured percentile thresholds.
- External dependency/container scan execution was not claimed locally; CI
  contains those gates and an authorized run remains release evidence.
