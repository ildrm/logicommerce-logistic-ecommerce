# Platform acceptance scenarios

These scenarios are the product-level acceptance journeys preserved from the
platform blueprint. Focused repository-level journeys for Phases 1–12 pass as
recorded in the verification record. A scenario is production-certified only
after every provider-dependent step in that deployment has evidence.

## Scenario A — B2C dropshipping

1. An administrator creates a supplier.
2. The supplier creates product data.
3. A merchant approves the product.
4. A seller creates an offer.
5. An inventory feed provides quantity.
6. A customer finds the product.
7. The customer checks out.
8. Inventory is reserved.
9. A dropship purchase order is created.
10. The supplier accepts it.
11. A shipment is created.
12. Tracking updates are received.
13. Delivery completes.
14. A seller settlement is generated.

## Scenario B — C2C transaction

1. A person registers.
2. The person completes seller onboarding.
3. The seller creates a used-product listing.
4. A moderator approves the listing.
5. A buyer submits an offer.
6. The seller counters.
7. The buyer accepts.
8. Payment is authorized.
9. The seller ships.
10. The buyer receives the item.
11. The payout becomes eligible.
12. The buyer and seller may review each other.

## Scenario C — B2B purchase

1. A business account is created.
2. Users and approvers are configured.
3. A contract price list is assigned.
4. A buyer requests a quote.
5. The seller revises the quote.
6. The buyer accepts the quote.
7. A purchase order is attached.
8. The approval policy runs.
9. An order is created using payment terms.
10. The order is partially fulfilled.
11. An invoice is generated.

## Scenario D — 3PL fulfillment

1. Inventory arrives with an ASN.
2. The warehouse receives inventory.
3. Quality inspection passes.
4. Putaway is completed.
5. An order is routed to the warehouse.
6. A pick wave is created.
7. A picker confirms picks.
8. A packer creates a package.
9. A carrier label is created.
10. The shipment is manifested.
11. Tracking is received.

## Scenario E — 4PL exception

1. The primary warehouse cannot fulfill.
2. The order enters a logistics exception.
3. The routing engine creates alternatives.
4. A control-tower operator reviews cost and SLA.
5. The operator approves rerouting.
6. A new fulfillment order is created.
7. The original reservation is released.
8. The audit record contains the complete decision history.

## Scenario F — Shop API

1. An external shop creates API credentials.
2. The shop reads the catalog through the API.
3. The shop checks inventory.
4. The shop creates an order with an idempotency key.
5. A duplicate submission returns the original result.
6. The platform creates fulfillment.
7. The shop receives a signed webhook.
8. The shop reports shipment.
9. The customer tracks the shipment.

## Scenario G — Security isolation

1. A user authenticates in tenant A.
2. The user attempts to access tenant B's order ID.
3. Access is denied without revealing whether the record exists.
4. Security and audit records are created.
5. An automated test verifies the behavior.

## Scenario H — Inventory concurrency

1. One unit is available.
2. Multiple customers submit checkout concurrently.
3. Only one reservation succeeds.
4. The remaining requests receive an inventory-unavailable response.
5. No negative inventory occurs.

## Scenario I — Finance

1. An order is captured.
2. Commission is calculated.
3. The payment fee is recorded.
4. The seller payable is recorded.
5. A refund is issued.
6. Settlement is recalculated through compensating ledger entries.
7. The journal remains balanced.

## Scenario J — Global freight

1. An authenticated individual or business submits multimodal freight demand.
2. The system produces a non-binding rate-card estimate or marks it
   `NEEDS_REVIEW`.
3. Operations publishes a binding immutable quote revision.
4. The customer accepts one valid quote and receives a canonical invoice.
5. The required payment schedule is satisfied through a signed provider event
   or approved business terms.
6. Operations plans ordered road, sea, air, or rail legs.
7. A road leg uses an internal or subcontracted assignment.
8. A driver coordinator records manual check-ins and resolves any stale
   check-in exception.
9. Operator/provider milestones form the chronological booking timeline.
10. Proof of delivery is recorded before booking completion.
11. Tenant and permission denial do not reveal cross-tenant existence.

The local mock-payment request-to-POD version of this scenario passes. Stripe
and Coinbase sandbox certification remains deployment evidence. The timeline
does not claim continuous GPS.

## Scenario K — International consolidation, insurance, customs, and postal exchange

1. Operations loads governed origin/destination locations and hubs.
2. A customer submits insured international cargo with declared value.
3. Operations issues a binding freight quote and a product-specific insurance
   quote with clause, exclusion, deductible, territory, and mode snapshots.
4. Freight acceptance creates the booking invoice; insurance acceptance
   creates a separate premium invoice.
5. Required payment activates freight and cargo-insurance coverage.
6. Operations creates parties, a consignment, a versioned multimodal transport
   document, and a customs filing.
7. Cargo is allocated to a scanned handling unit and received at the origin hub.
8. The eligible consignment joins a capacity-controlled consolidation before
   cutoff and the handling unit is loaded.
9. The consolidation receives a shared linehaul allocation and can proceed
   through arrival, deconsolidation, and onward distribution.
10. A loss within active coverage creates an owned, auditable claim and the
    claims operator assesses it under least privilege.
11. A postal customer creates an item with required customs data and a valid
    S10 identifier.
12. Postal operations load the item into a compatible receptacle and dispatch,
    hand it over, and ingest idempotent standard events.
13. Dashboard signals expose claims, handling/consolidation failures, customs
    holds, postal exceptions, and late handovers.
14. Cross-tenant and insufficient-permission access is denied.

The local repository journey is implemented in
`tests/e2e/phase13-live.mjs`. Provider/dataset conformance and licensing remain
deployment evidence.

## Evidence requirements

For each scenario, record:

- the owning phase and modules;
- seed or fixture setup;
- automated unit, integration, concurrency, and E2E tests;
- permissions and tenant-isolation assertions;
- audit events and relevant metrics;
- mock versus production provider boundaries;
- the commit and CI run that passed;
- known production limitations.
