# Implementation status

Last evidence update: **2026-08-10**. See the
[verification record](docs/testing/verification-record.md) for commands and
runtime results, and the
[continuation guide](docs/development/continuation-guide.md) for the exact next
implementation slice.

Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTED`, `DOCUMENTED`.

| Phase                                                                      | Status | Evidence / current boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Next required outcome                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Repository and platform foundation                                      | TESTED | Monorepo, pinned dependencies, apps, packages, Docker images, migration, seed, CI workflow, documentation, unit/E2E tests, and live health paths validated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Maintain dependency, migration, CI, Compose, documentation, and health-check gates across all domain changes.                                                                                           |
| 1. Tenancy, identity, authorization                                        | TESTED | Trusted-domain tenant resolution; password, verification, reset, and passwordless flows; rotating sessions; TOTP/recovery MFA; tenant-scoped role, user, grant, and machine-credential administration; deny-by-default authorization; audit; accessible administration UI; and two-tenant non-enumeration are covered by unit, live MySQL/Redis, and desktop/mobile browser tests.                                                                                                                                                                                                                                                                                                                                                              | Maintain provider ports and configure production email/OIDC/social adapters when vendors are selected.                                                                                                  |
| 2. Stores, catalog, offers, storefront                                     | TESTED | Tenant-scoped stores/domains, locale/currency/branding, taxonomy and attributes, suppliers/sellers, approval workflow, products/variants/media/translations/SEO, offer publication, a replaceable MySQL search adapter, availability, public browse/detail APIs, and responsive storefront loading/empty/error states. The live exit journey and cross-tenant denial pass.                                                                                                                                                                                                                                                                                                                                                                      | Preserve sellable-product and tenant-isolation invariants; replace the MySQL search adapter only when measured scale requires it.                                                                       |
| 3. Inventory, cart, checkout, B2C orders                                   | TESTED | Idempotent inventory feeds; derived balances and immutable ledger; expiring reservations and worker release; reconciliation; carts, promotions, deterministic tax/shipping/address/fraud/payment ports; idempotent transactional checkout; seller/supplier splits; orders; dropship POs; acceptance/allocation; and customer/operations views. A live one-unit race returns exactly one 201 and one 409 with no negative stock.                                                                                                                                                                                                                                                                                                                 | Preserve concurrency and ledger invariants; certify or replace remaining deterministic tax, address, fraud, shipping, and carrier adapters before production.                                           |
| 4. Fulfillment, WMS, TMS, tracking                                         | TESTED | Tenant-scoped facilities/bins, ASN receiving and inspection, ledger-backed putaway, fulfillment orders, pick/pack, deterministic carrier rates and labels, manifest/dispatch, normalized tracking, customer tracking, and the responsive operations rail passed the live ASN-to-delivery journey and cross-tenant denial.                                                                                                                                                                                                                                                                                                                                                                                                                       | Preserve warehouse, shipment-state, tracking, and ledger invariants; certify contracted carrier/WMS adapters before production.                                                                         |
| 5. C2C                                                                     | TESTED | Identity verification, seller profiles, used listings/media/condition, prohibited-goods screening, moderation, offers, buyer protection, shipment evidence, disputes, payout eligibility/release, and mutual reviews passed the live seller-to-review journey as a distinct policy boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Maintain the distinct C2C protection, dispute, and payout-policy boundary as production providers are selected.                                                                                         |
| 6. B2B                                                                     | TESTED | Business accounts/members, spend and approval limits, contract prices, RFQs and quotes, PO references, payment terms, partial fulfillment, and invoice issuance passed the live RFQ-to-invoice journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Keep legacy invoice compatibility while new issuance, payment schedules, and freight credit decisions use canonical billing.                                                                            |
| 7. Seller, supplier, Shop APIs                                             | TESTED | Scoped credentials, IP policy, rotation, rate limits, catalog/inventory reads, idempotent orders, fulfillment, encrypted webhook secrets, HMAC signatures, replay windows, retries/dead letters, inbound receipts, and manual replay passed live. A discovered webhook event-identity collision was corrected and revalidated.                                                                                                                                                                                                                                                                                                                                                                                                                  | Preserve version compatibility, credential rotation, replay safety, delivery evidence, and tenant scope as partner integrations expand.                                                                 |
| 8. Returns, finance, settlements                                           | TESTED | Tenant-scoped RMA request through disposition/restock/refund; immutable balanced journals and atomic reversals; chart of accounts, reconciliation, settlement reserves/adjustments/approval/payout passed the live journey and tenant denial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Preserve compensation and posted-history invariants while production payment/settlement providers are selected.                                                                                         |
| 9. 3PL and 4PL maturity                                                    | TESTED | Logistics clients, versioned contracts/rate cards/SLA, isolated inventory allocation, single-use billing events/invoices, control-tower exceptions, deterministic alternatives, separate human approval, safe pre-pick facility transfer, and decision audit passed live.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Validate contracted warehouse/provider adapters and multi-site operating volumes before production.                                                                                                     |
| 10. 5PL foundation                                                         | TESTED | Versioned network models, frozen inputs/constraints/objectives, canonical hashes, deterministic feasible ranking, explicit non-optimality explanation, approval, execution, outcome variance, and rollback passed unit and live reproducibility tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Calibrate and independently validate a solver/model before making any mathematical-optimality claim.                                                                                                    |
| 11. Hardening                                                              | TESTED | Metrics, SLO evidence, RPO/RTO evaluation, retention/legal hold, hashed-subject privacy, ingress limits/CSP/HSTS, responsive UI, runbooks, CI scan/SBOM gates, and hardening artifacts passed repository/browser/live/load validation. k6 passed 48,685 iterations at 25 VUs with 0% failures and p95 72.24 ms. External provider evidence remains explicit.                                                                                                                                                                                                                                                                                                                                                                                    | Obtain authorized CI scan/SBOM results, measured coverage, external penetration evidence, and a production-provider restore exercise.                                                                   |
| 12. Global freight, billing, payments, and driver coordination             | TESTED | Append-only freight/billing schema and idempotent seed; global multimodal requests, reviewed estimates and binding quote revisions; atomic booking/invoice/schedule creation; canonical B2C/B2B/3PL/freight invoices; Stripe Checkout, Coinbase Business Checkout, and local mock adapters; signed idempotent webhooks, allocations, journals and refunds; internal/subcontracted fleet, encrypted driver contacts, manual check-ins, overdue exceptions, POD; customer and operations workspaces; and control-tower analytics. The full local request-to-POD live journey, tenant denial, permission denial, migration, seed, production builds, and provider signature tests pass.                                                            | Run Stripe and Coinbase sandboxes with deployment-specific keys, validate webhook reachability/reconciliation/refund drills, and complete external security/backup evidence before tenant activation.   |
| 13. International logistics, insurance, consolidation, and postal exchange | TESTED | Governed international locations/code lists; parties, consignments, multimodal document revisions, and customs filings; versioned cargo-insurance products, premium invoices, payment-gated policies, and claims; hubs, nested handling units, SSCC/VGM, consolidation/deconsolidation, shared linehaul capacity; UPU-style item/receptacle/dispatch/consignment hierarchy and S10/events; least-privilege roles; customer/operations workspaces; worker signals; and international analytics are implemented in two append-only migrations. Production images built, unit/static gates passed, the live insurance/customs/handling/consolidation/postal/tenant/analytics journey passed, and all 12 desktop/mobile browser regressions passed. | Obtain licensed reference data, provider agreements/adapters, jurisdictional legal review, external conformance evidence, and provider/security/recovery drills before regulated production activation. |

## Current focus

Phases 0–13 are implemented at repository scope. The production release
hardening adds real external commerce, carrier, identity-verification, C2C
escrow, document-scanner, SMTP, payment, and partner-webhook paths; development
adapters fail closed in production. It also adds seller-scoped B2B access,
non-destructive MFA enrollment, durable refunds/outbox/webhook processing,
checksum-and-length-bound staged uploads, durable C2C hold release, provider
HTTP limits, frontend token refresh, and production CI/Compose gates.

The repository is a **release candidate**, not an approved production release.
The measured whole-API coverage baseline is 10.55% lines, below the 80%
domain-critical release target. Provider sandbox certification, licensed data
and agreements, external penetration and regulatory review, backup/restore
drills, secrets/telemetry/on-call integration, and an authorized green CI run
remain release evidence. Continuous GPS and tenant-level freight feature-flag
policy remain explicit product/deployment decisions.

## Production release hardening — 2026-08-10

- Production configuration rejects repository placeholders, weak or reused
  secrets, insecure origins/cookies, missing webhook allowlists, and every
  local mock, preview, or deterministic provider adapter.
- Commerce and carrier provider calls are authenticated, bounded, non-redirecting,
  and idempotent where state changes. Stripe/Coinbase webhook and refund paths
  retain durable deduplication and retry semantics.
- C2C KYC and escrow use external providers. Countered, rejected, and expired
  offers transactionally enqueue idempotent payment-hold releases, which a
  leased scheduler retries until acknowledgement.
- SMTP requires TLS 1.2 or newer and validated certificates. Partner webhooks
  resolve and validate public addresses once, pin the chosen address into the
  HTTPS connection, bound responses, retry with leases, and dead-letter.
- Freight uploads stage under generated keys, sign exact content type/length and
  S3-verified SHA-256, delete mismatches, require a scanner digest attestation,
  and expose only CLEAN proof-of-delivery documents.
- CI now validates formatting, lint, types, unit suites, an uploaded API coverage
  summary, production dependency audit, builds, Compose rendering, containers,
  all live phase journeys, browser journeys, Trivy source scanning, and SBOM.
- The sealed production-hardening security diff review closed 56/56 review rows.
  Its five findings were remediated with focused regression coverage before the
  final repository gates.

## Freight travel and event timeline

- A specific chronological booking timeline is implemented in `/freight` under
  **Bookings and movement**.
- It is backed by `TransportMilestone` records ordered by `occurredAt`.
  Operator-entered modal events, manual driver check-ins, and proof of delivery
  can add milestones.
- Booking API reads also return ordered legs, assignment check-ins,
  operational exceptions, and proof-of-delivery evidence.
- It is not continuous GPS tracking. The current customer UI does not merge
  quote, invoice, payment, assignment, exception-resolution, and travel events
  into one universal lifecycle timeline.
- The exact contract and limitations are documented in the
  [freight journey timeline](docs/logistics/freight-journey-timeline.md).
- Phase 13 adds separate chronological handling/custody histories,
  cargo-insurance claim histories, and postal item event timelines. These are
  deliberately independent projections because a booking, handling unit,
  claim, and postal item have different identities and event semantics.

## Phase 13 international logistics structure

- The expert audit and production boundaries are recorded in
  [international logistics system audit](docs/product/international-logistics-system-audit.md).
- The international object and standards map is recorded in
  [international standards map](docs/logistics/international-standards-map.md).
- Customer workspaces: `/freight` for freight, insurance, invoices, and
  movement; `/postal` for postal acceptance and item timelines.
- Operations workspaces: `/operations/network`, `/operations/insurance`, and
  `/operations/postal`.
- The analytical dashboard exposes handling exceptions, consolidation cutoff
  or execution failures, open insurance claims, customs holds, postal
  exceptions, and late dispatch handovers.

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

## Phase 12 verification summary

- Migration `20260728055751_phase12_transport_billing` applied after preserving
  all historical tenant foreign keys; the updated seed passed twice.
- Production API, worker, web, and migration images built successfully; all
  eight long-lived Compose services were healthy.
- Formatting and package-scoped lint/typecheck passed. Unit suites passed 35
  tests, including 22 API tests and Stripe/Coinbase signature, stale-event, and
  production mock fail-closed coverage.
- The live journey passed request creation/submission, reviewed estimate,
  binding quote publication/acceptance, canonical invoice numbering, mock
  prepayment, road planning, subcontracted carrier/driver/vehicle assignment,
  phone check-in and replay protection, assignment completion, proof of
  delivery, booking completion, invoice PDF access, analytics, tenant denial,
  and permission denial.
- `/freight`, `/operations/freight`, `/operations/dispatch`, and
  `/operations/billing` are responsive functional workspaces. `/dashboard`
  reports freight backlog, quote responsiveness, payment blocks, overdue
  receivables, modes/statuses, delayed legs, exceptions, and stale check-ins.
- All prior live authentication, commerce, network, and Phase 8–11 regressions
  passed. Playwright passed 12/12 desktop/mobile scenarios, including the new
  freight, dispatch, billing, and dashboard surfaces.
- Production mock payment activation fails closed. Live Stripe/Coinbase
  certification remains deployment evidence because no provider secrets are
  committed.
