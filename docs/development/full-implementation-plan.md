# Full implementation plan

This is the execution plan for completing Phases 1–11. The accepted modular
monolith remains the default: modules own their application services and
repositories, use tenant-scoped persistence, and communicate asynchronously
through the transactional outbox. A phase advances only when its roadmap exit
scenario has automated evidence.

## Delivery sequence

1. **Identity boundary** — trusted-domain tenant resolution, Redis-backed auth
   rate limits, deny-by-default permission guards, role administration,
   password recovery/verification, TOTP/recovery codes, session UI, audit, and
   two-tenant tests.
2. **Sellable product** — stores/channels, taxonomy, products/variants/media,
   supplier submissions, merchant approvals, offers/prices, MySQL search, and
   accessible storefront discovery.
3. **Transactional commerce** — inventory feeds/ledger/reservations, cart,
   quotations, checkout orchestration, payment/tax/fraud mock ports, B2C order
   state machine, split orders, dropship purchase orders, and concurrency tests.
4. **Physical fulfillment** — facilities/bins, ASN receiving/inspection/
   putaway, fulfillment orders, waves, pick/pack, carrier rate/label/tracking
   ports, shipment events, SLA timers, and customer tracking.
5. **C2C** — onboarding/KYC port, moderated used-item listings, negotiation,
   buyer protection, shipment evidence, disputes, payout eligibility, and
   reviews.
6. **B2B** — account hierarchy, contract catalogs/pricing, RFQ/quote,
   approvals, PO, terms, partial fulfillment, and invoices.
7. **Partner surfaces** — seller/supplier portals, scoped rotating API
   credentials, rate/IP policies, idempotent Shop API orders, signed webhooks,
   retry/dead-letter processing, and replay UI.
8. **Reverse logistics and money** — return authorization through disposition,
   balanced double-entry journals, commissions/fees/tax, reconciliation,
   settlements, reserves, statements, and compensating-entry tests.
9. **3PL/4PL** — multi-client warehouse contracts/rate cards/billing, strict
   client isolation, exception alternatives, operator approval, reservation
   transfer, and complete decision history.
10. **5PL foundation** — frozen/versioned inputs, objectives/constraints,
    deterministic explainable recommendations, human approval, outcome
    measurement, and rollback. No unproved optimality claims.
11. **Production hardening** — measured coverage, load/concurrency/a11y/browser
    tests, SAST/dependency/container scanning and SBOM, metrics/traces/alerts,
    runbooks, backup/restore and DR exercises, secrets/key rotation, rollout and
    rollback evidence.

## Cross-phase implementation contract

Every slice includes requirements, schema plus a new migration, idempotent
fixtures, application service/repository boundaries, tenant isolation,
deny-by-default authorization, audit, validation, Problem Details, idempotency
and concurrency behavior, responsive accessible UI states, structured logs and
metrics, unit/integration/E2E tests, and updated status/verification documents.

## Verification targets

- API latency at design load: p50 <= 50 ms, p95 <= 150 ms, p99 <= 400 ms.
- Mobile 4G: LCP <= 2.0 s, INP <= 100 ms, CLS <= 0.1.
- Availability after hardening: 99.95%; RPO <= 15 minutes; RTO <= 60 minutes.
- Domain-critical coverage before phase exit: at least 80%.
- All final acceptance journeys A–I and tenant/inventory/finance invariants
  pass through the production-like Compose topology.

## Immediate Phase 1 slices

1. **Completed 2026-07-22:** trusted domain resolution, auth endpoint rate
   limits, reusable permission decorators/guards, denied-action audit, and live
   integration coverage.
2. **Completed 2026-07-23:** role/permission and user-role assignment APIs plus
   accessible administration UI.
3. **Completed 2026-07-23:** verification/reset/passwordless token persistence
   and non-enumerating mock-mail workflows.
4. **Completed 2026-07-23:** TOTP enrollment/challenge/recovery codes and
   MFA-aware login.
5. **Completed 2026-07-23:** sign-in/session UI, two-tenant non-enumeration,
   machine credentials, security audit evidence, isolated CI integration, and
   Phase 1 exit-scenario evidence.

Phases 1–3 are `TESTED`. The immediate implementation target is now Phase 4:
facilities and inbound receiving followed by fulfillment orders, warehouse
execution, carrier adapters, shipments, tracking, and delivery.
