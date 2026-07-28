# Product and implementation phase roadmap

This roadmap records the implemented product scope and retained release
boundaries. Phases 1–12 have repository-level automated evidence; Phase 13
adds the international operating structure and is subject to its recorded
validation/provider boundaries. Production
provider activation and external release evidence remain separate.

The authoritative current status remains
[IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md).
The final journeys are preserved separately in
[acceptance-scenarios.md](acceptance-scenarios.md).

## Phase 1 — Tenancy, identity, and authorization

### Goal

Provide secure tenant resolution, authentication, sessions, MFA, and
deny-by-default authorization for every later domain.

### Implemented capabilities

- Password login plus non-enumerating email verification, reset, and
  passwordless-email workflows using hashed, expiring, single-use tokens.
- Rotating refresh tokens, reuse detection, and session/device management.
- TOTP MFA with encrypted secrets, replay prevention, and single-use recovery
  codes.
- A provider-neutral OIDC/social adapter port and registry. Concrete external
  providers remain deployment integrations because no vendor is selected.
- Tenant-scoped roles, permissions, grants, user-role assignment APIs, and an
  accessible responsive administration UI.
- Trusted host/domain tenant resolution and hashed, scoped, revocable machine
  credentials.
- Two-tenant non-enumeration, denied-action audit, live security, and
  desktop/mobile browser tests.

### Exit scenario

A tenant administrator signs in, completes MFA, manages a role, sees active
sessions, revokes one, and cannot access a second tenant's resource or infer its
existence. Security and audit records are produced. This scenario passed on
2026-07-23; see the
[verification record](../testing/verification-record.md#phase-1-completion--2026-07-23).

## Phase 2 — Stores, catalog, offers, and storefront

### Goal

Create the sellable-product model shared by marketplace, dropshipping, C2C,
and B2B channels.

### Implemented capabilities

- Store/channel configuration, domains, locale, currency, and branding.
- Categories, attributes, products, variants, media, translations, and SEO.
- Supplier product data and merchant approval workflow.
- Seller offers, prices, availability, minimum quantities, and channel rules.
- Search abstraction with a MySQL baseline and external-engine adapter.
- Storefront browse, search, product detail, loading, empty, and error states.

### Exit scenario

A supplier submits product data, a merchant approves it, a seller publishes an
offer, and a customer finds the product through the storefront without any
cross-tenant leakage. This scenario passed on 2026-07-23; see the
[verification record](../testing/verification-record.md#phase-2-and-3-completion--2026-07-23).

## Phase 3 — Inventory, cart, checkout, and B2C orders

### Goal

Complete the first transactional commerce journey with concurrency-safe stock.

### Implemented capabilities

- Inventory sources, feeds, balances, ledger entries, reservations, expiry,
  release, and reconciliation.
- Cart and line validation, promotions, tax and shipping quotations.
- Address, payment, and fraud adapter boundaries.
- Checkout orchestration, order state machine, split orders, and idempotency.
- Dropship purchase orders and supplier acceptance.
- Customer and operations order views.

### Exit scenarios

- Complete the B2C dropshipping scenario in the original blueprint.
- With one unit available and concurrent checkouts, exactly one reservation
  succeeds and the ledger never becomes negative.

The Phase 3 boundary through dropship purchase-order acceptance passed on
2026-07-23. Shipment, tracking, and settlement steps remain owned by Phases 4
and 8; see the
[verification record](../testing/verification-record.md#phase-2-and-3-completion--2026-07-23).

## Phase 4 — Fulfillment, WMS, TMS, and tracking

### Goal

Move accepted orders through warehouse and carrier operations.

### Capabilities

- Facilities, bins, ASNs, receiving, inspection, putaway, and transfers.
- Fulfillment orders, waves, pick, pack, package, label, manifest, and dispatch.
- Carrier service/rate/label/tracking adapter contracts.
- Shipment and tracking event normalization.
- SLA timers, operational exceptions, and customer tracking.

### Exit scenario

Inventory arrives via ASN, is received and put away, then an order is picked,
packed, labeled, manifested, shipped, and tracked through delivery.

## Phase 5 — C2C marketplace

### Goal

Support person-to-person listings, negotiation, moderation, protection, and
payout eligibility.

### Capabilities

- Seller onboarding and identity-verification adapter.
- Used-item listings, media, condition, moderation, and prohibited-item rules.
- Offers, counteroffers, acceptance, and expiration.
- Buyer protection, shipment evidence, disputes, reviews, and payout holds.

### Exit scenario

A person lists a used item, passes moderation, negotiates with a buyer, ships,
reaches payout eligibility, and both parties may review each other.

## Phase 6 — B2B commerce

### Goal

Support account hierarchies, contract pricing, quotes, approvals, purchase
orders, terms, partial fulfillment, and invoicing.

### Capabilities

- Business accounts, departments, buyers, approvers, and spend controls.
- Contract catalogs and price lists.
- RFQ and quote negotiation.
- Purchase orders, approval policies, credit terms, partial shipments, and
  invoices.

### Exit scenario

A business buyer accepts a negotiated quote under an approval policy, attaches
a PO, orders on payment terms, receives a partial fulfillment, and gets an
invoice.

## Phase 7 — Seller, supplier, and Shop APIs

### Goal

Expose controlled partner operations through portals and versioned APIs.

### Capabilities

- Seller and supplier onboarding, catalog, offer, inventory, order, fulfillment,
  return, and finance surfaces.
- API credentials, scopes, rotation, rate limits, IP policy, and audit.
- Idempotent order submission and signed, replay-protected webhooks.
- Webhook delivery attempts, retry schedules, dead letters, and replay UI.

### Exit scenario

An external shop reads catalog and inventory, submits the same idempotent order
twice and receives one result, fulfills it, and exchanges verified webhooks.

## Phase 8 — Returns, finance, and settlements

### Goal

Model reverse logistics and auditable money movement without mutable history.

### Capabilities

- Return authorization, labels, receipt, inspection, disposition, replacement,
  refund, and dispute flows.
- Double-entry accounts, journals, postings, commissions, fees, tax, payables,
  receivables, reserves, and provider reconciliation.
- Seller/supplier/carrier settlement periods, statements, adjustments, and
  payout eligibility.

### Exit scenario

Capture, commission, payment fee, seller payable, refund, and settlement
recalculation are represented by balanced entries and compensations; posted
history remains immutable.

## Phase 9 — 3PL and 4PL maturity

### Goal

Provide multi-client logistics operations and human-governed network
orchestration.

### Capabilities

- 3PL clients, facilities, service catalogs, contracts, rate cards, SLA and
  billing events.
- Cross-client isolation and warehouse operational dashboards.
- 4PL routing alternatives, exception cases, approval workflows, cost/SLA
  comparison, and complete decision history.

### Exit scenario

When a primary warehouse cannot fulfill, the control tower presents feasible
alternatives, an operator approves a route, reservations are transferred
safely, and the audit history explains the decision.

## Phase 10 — 5PL foundation

### Goal

Add governed, measurable network optimization without overstating autonomy.

### Capabilities

- Demand, capacity, cost, carbon, carrier, facility, and SLA input models.
- Versioned objectives and constraints.
- Deterministic recommendation runs with reproducible inputs and outputs.
- Human approval, rollout controls, outcome measurement, and rollback.

### Exit scenario

A versioned optimization run produces explainable alternatives from frozen
inputs, an operator approves one, and actual outcomes are compared with the
forecast. Do not call this mathematically optimal until a validated solver and
model prove that claim.

## Phase 11 — Hardening and production readiness

### Goal

Demonstrate that the full platform can be operated safely at the agreed SLOs.

### Capabilities

- Measured coverage, load tests, concurrency tests, accessibility, browser
  matrix, dependency and container scanning, SBOM, and penetration testing.
- Metrics, traces, dashboards, alerts, runbooks, and incident exercises.
- Backup/restore tests, RPO/RTO evidence, retention, legal hold, and privacy
  workflows.
- Secret management, key rotation, production orchestration, scaling, rollout,
  rollback, and disaster recovery.
- Evidence for final scenarios A–I.

### Exit scenario

All repository gates, Docker startup, domain-critical E2E scenarios, tenant
isolation, inventory concurrency, balanced finance, restore drills, and the
agreed performance targets pass with recorded evidence.

## Phase 12 — Global freight, billing, payments, and driver coordination

### Goal

Let authenticated individuals and businesses request global multimodal
transport, receive and accept a reviewed quote, receive an invoice, pay through
a hosted provider or approved terms, and follow execution to proof of delivery.

### Implemented capabilities

- Road, sea, air, and rail requests with stops, cargo, document upload signing,
  non-binding estimates, reviewed immutable quote revisions, and atomic booking
  acceptance.
- Ordered legs, modal milestones, operational exceptions, proof of delivery,
  internal/subcontracted carriers, and road driver/vehicle assignments.
- A restricted `driver-coordinator` role, encrypted driver phones, manual
  phone/SMS/WhatsApp/carrier-portal check-ins, and worker-created overdue
  exceptions.
- Canonical invoices, schedules, hosted Stripe Checkout and Coinbase Business
  Checkout adapters, durable signed payment events, allocations, refunds,
  credit notes, and balanced journals.
- Customer freight, freight operations, dispatch, billing, and analytical
  dashboard workspaces.
- A chronological booking milestone timeline. Continuous GPS and a unified
  quote/payment/travel audit feed are not claimed.

### Exit scenario

An authenticated customer submits freight demand, accepts an operator-published
quote, satisfies the required schedule, follows planned multimodal legs and
manual road check-ins, and receives proof of delivery and a complete booking.
The local provider-neutral journey, tenant/permission denial, and
desktop/mobile workspaces pass. Deployment-specific Stripe/Coinbase sandbox,
webhook reachability, reconciliation, refund, and restore drills remain release
evidence.

## Phase 13 — International logistics, insurance, consolidation, and postal exchange

### Goal

Separate and operate the international objects that a freight booking alone
cannot represent: consignment, transport/customs documents, insured interest,
physical handling units, shared movements, and postal exchange levels.

### Implemented capabilities

- Versioned international code-list provenance and standard locations with
  UN/LOCODE, IATA, IMPC, GLN, function, coordinate, and time-zone fields.
- Transport parties, consignments, immutable document revisions, and
  WCO-oriented customs filing transitions.
- Versioned cargo-insurance providers/products, eligibility and premium
  calculation, canonical premium invoice, payment-gated policy activation,
  certificates, claims, decisions, and event evidence.
- Logistics hubs, nested handling units, cargo allocation, custody scans,
  condition exceptions, SSCC check digits, and maritime VGM gates.
- Cross-booking consolidation, capacity/cutoff controls, load positions,
  shared linehaul allocation, arrival, deconsolidation, and distribution.
- Postal operators/products and independent item, receptacle, dispatch, postal
  consignment, and event records with S10 check-digit validation.
- Least-privilege roles, customer/operations workspaces, worker monitoring,
  and analytical exception signals.

### Exit scenario

An insured international consignment is documented and lodged for customs,
received into a traceable handling unit, consolidated with capacity controls,
allocated to shared linehaul, deconsolidated, and distributed. In parallel, an
international postal item receives a valid S10 identifier, moves through a
receptacle and dispatch, and records idempotent exchange events. Premium
payment activates coverage, a customer can submit an owned claim, and all
cross-tenant/permission attempts are denied.

Provider/dataset licensing, national customs and postal EDI, carrier network
conformance, dangerous-goods certification, and jurisdictional legal approval
remain external release evidence.

## Cross-phase definition of done

Every completed module requires documented requirements and rules, schema and
migration where applicable, seed data, API, authorization, tenant isolation,
audit, validation, errors, idempotency, responsive and accessible UI states,
unit/integration/E2E tests, logs, metrics, documentation, passing Docker build,
and explicitly documented production limitations.
