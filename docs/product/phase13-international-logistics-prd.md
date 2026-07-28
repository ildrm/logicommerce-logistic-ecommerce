# Phase 13 PRD — international logistics, insurance, consolidation, and postal exchange

Status: implemented foundation; external-provider certification pending  
Owner: Product and Network Operations  
Last updated: 2026-07-28

## Problem

Customers and operators need to move, insure, consolidate, document, clear, exchange, and track international cargo and postal items. A freight booking alone cannot safely represent these jobs. The platform requires independent domain objects, identifiers, permissions, state machines, and exception signals while preserving the existing commerce, freight, billing, payment, audit, and tenant foundations.

## Goals

- Represent internationally recognizable locations, parties, consignments, transport documents, customs filings, physical handling units, and shared movements.
- Quote and bind explicit cargo-insurance coverage, collect premium through canonical billing, and manage claims.
- Consolidate multiple consignments/shipments at hubs, allocate shared capacity, deconsolidate, and distribute onward.
- Represent postal item, receptacle, dispatch, and transport consignment levels independently.
- Give customers and operators task-specific workspaces and timeline evidence.
- Detect operational failures in the analytical dashboard.

## Non-goals

- Claiming regulatory certification or operator designation.
- Automated customs filing in every country.
- Acting as an insurer, insurance intermediary, postal designated operator, or GS1 issuing organization.
- Live GPS, IoT custody, or autonomous physical control.
- Replacing licensed dangerous-goods, sanctions, tax, or commodity-classification providers.

## Functional scope

### International transport

- Governed location and code-list records.
- Transport party and consignment records linked to an eligible freight booking.
- Multimodal transport documents with issue/sign/surrender/void transitions and immutable revisions.
- Versioned customs filings with lodge/hold/release/reject responses.

### Insurance

- Versioned provider and product catalogs with territory, mode, currency, valuation uplift, rate, minimum premium, deductible, clauses, and exclusions.
- Non-destructive quote snapshot with declared and insured values.
- Acceptance creates a policy/certificate plus canonical premium invoice and prepayment schedule.
- Payment activates coverage.
- Customer-owned loss notification and controlled claims lifecycle with event evidence.

### Consolidation and physical flow

- Hubs/gateways with capabilities and bonded status.
- Nested handling units with SSCC/external identifiers, content allocations, condition, custody events, and container VGM.
- Consolidation members and load units, weight/volume capacity enforcement, cutoff, load, departure, arrival, deconsolidation, and completion.
- Shared international linehaul with explicit allocations.

### Postal

- Operator and product catalog.
- S10 creation and check-digit validation.
- Item acceptance with sender, recipient, content, customs, value, weight, and events.
- Receptacle loading and close/despatch/receive/open sequence.
- Dispatch construction and handover.
- Postal transport consignment for carrier handoff.
- Idempotent UPU-style/internal event ingestion.

## Success measures

- No cross-tenant resource disclosure in Phase 13 live tests.
- 100% of accepted insurance quotes produce one policy and one canonical invoice.
- 100% of paid insurance invoices activate only their referenced policy.
- No consolidation or linehaul allocation can exceed configured weight/volume.
- No packed sea container reaches loaded state without VGM.
- No postal receptacle can close empty and no dispatch can close without receptacles.
- Duplicate handling/postal provider events resolve to the original event.
- Dashboard reports open claims, handling exceptions, missed consolidation cutoffs, postal exceptions/delays, and customs holds.

## Release controls

- Tenant feature flags and explicit permission grants.
- Seed data is demonstration-only and marked as non-regulatory.
- Mock payments remain development/test only.
- Production readiness requires the external dependency gates in the international system audit.
