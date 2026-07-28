# International transportation, logistics, postal, and product audit

Last reviewed: 2026-07-28

## Executive assessment

The pre-audit platform had a credible commerce and freight-booking foundation, but it was not yet a complete international logistics or postal operating system. The main structural problem was that a customer freight booking was being used as a substitute for several different real-world objects: transport consignment, transport contract/document, physical handling unit, consolidated movement, customs declaration, insured interest, and postal item. Those objects have different identifiers, custody rules, state machines, parties, documents, and exception semantics.

Phase 13 corrects that architecture. It introduces governed international reference data; consignments, parties, multimodal documents, and customs filings; cargo-insurance products, premium invoices, policies, and claims; hubs, nested handling units, consolidation, shared linehaul, and deconsolidation; and the postal item → receptacle → dispatch → consignment hierarchy. The API, authorization, worker monitoring, customer surfaces, operational workspaces, analytics, migration, seed, and tests now use these concepts.

This is a broad international logistics foundation, not a claim of regulatory certification. Production operation still requires licensed insurers, GS1-issued identifiers, operator/carrier agreements, country customs connectors, dangerous-goods validation, sanctions controls, and jurisdiction-specific legal review.

## Expert findings and disposition

| Severity | Perspective                  | Finding                                                                                                  | Operational consequence                                                                                      | Disposition                                                                                                                                                                           |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Transportation               | Booking, consignment, transport document, and movement were conflated.                                   | Incorrect document ownership, poor multimodal handoff evidence, and no master/house structure.               | Corrected with `TransportConsignment`, `TransportParty`, immutable document revisions, and independent linehaul allocations.                                                          |
| Critical | Logistics                    | No handling-unit identity or custody model existed.                                                      | Pallets, bags, ULDs, cages, and containers could not be scanned, nested, reconciled, or traced through hubs. | Corrected with `HandlingUnit`, content allocation, nesting, SSCC validation, VGM evidence, and append-only handling events.                                                           |
| Critical | Logistics                    | No cross-booking consolidation or deconsolidation existed.                                               | The system could not combine cargo at an origin hub, share capacity, break bulk, or distribute onward.       | Corrected with hubs, consolidation members/loads, capacity checks, cutoff enforcement, shared linehaul allocation, and deconsolidation states.                                        |
| Critical | Insurance                    | Cargo insurance was only a request boolean and document kind.                                            | No coverage type, clause edition, premium, deductible, certificate, insured value, or claims workflow.       | Corrected with provider/product versions, ICC-style clause snapshots, quote calculation, premium invoice/payment activation, policy certificate, loss evidence, and claims lifecycle. |
| Critical | Postal                       | No postal operating hierarchy existed.                                                                   | Item scans could not be reconciled with receptacles, dispatches, or transport consignments.                  | Corrected with S10 validation and explicit item, receptacle, dispatch, postal consignment, and standard-event records.                                                                |
| High     | Customs                      | Customs was represented only by a flag and uploaded files.                                               | No declaration revision, lodging, hold, release, rejection, MRN, or response evidence.                       | Corrected with versioned WCO-data-model-oriented filing records and controlled transitions.                                                                                           |
| High     | International reference data | Free-text locations were not backed by governed codes.                                                   | Ambiguous ports, airports, rail terminals, IMPCs, time zones, and routing.                                   | Corrected with versioned code-list imports and locations supporting UN/LOCODE, IATA, IMPC, GLN, coordinates, and function codes.                                                      |
| High     | Maritime safety              | Packed-container VGM was not represented.                                                                | A sea container could be loaded without verified gross-mass evidence.                                        | Corrected: container loads require VGM before consolidation reaches `LOADED`; method and verifier are recorded.                                                                       |
| High     | Capacity control             | Shared movements had no allocated weight/volume checks.                                                  | Overbooking and unexplainable utilization.                                                                   | Corrected with atomic capacity checks on consolidation and linehaul allocations.                                                                                                      |
| High     | Identity and duties          | No hub, postal, or insurance claims roles existed.                                                       | Excessive administrator use and weak segregation of duties.                                                  | Corrected with least-privilege `hub-operator`, `postal-operator`, and `insurance-adjuster` roles and 13 new permissions.                                                              |
| High     | Finance                      | An accepted insurance quote could have become coverage without a premium receivable.                     | Uncollected premium and ambiguous coverage inception.                                                        | Corrected: acceptance creates a canonical invoice and schedule; payment activates the policy.                                                                                         |
| High     | Exceptions                   | Consolidation cutoff, postal handover, insurance expiry, and international-process risks were invisible. | Missed departures and aging claims were hard to detect.                                                      | Corrected in the worker and analytical dashboard with durable events and process-specific signals.                                                                                    |
| Medium   | Product                      | Freight, postal, insurance, and network work were not discoverable as separate jobs.                     | Operators navigated generic pages and customers could not understand the service model.                      | Corrected with customer postal/freight workspaces, three international operations consoles, process directory entries, and dashboard links.                                           |
| Medium   | Product                      | Status strings were duplicated in clients.                                                               | UI/API drift.                                                                                                | Corrected by adding shared contract types for consolidation, handling, insurance, postal, and locations.                                                                              |
| Medium   | Auditability                 | Several new operational events could be replayed by providers.                                           | Duplicate scans and inconsistent timelines.                                                                  | Corrected with tenant-scoped external keys for handling and postal events and append-only event histories.                                                                            |

## Product-manager and product-owner evaluation

### Users and jobs

- Freight customers need a quoteable movement, explicit coverage, invoice/payment, document access, and a single journey timeline.
- Freight operations need request review, parties, consignments, document revisions, customs evidence, shared movements, and exception ownership.
- Hub operators need scan-first unit custody, capacity, cutoff, load position, VGM, discrepancy, deconsolidation, and onward distribution.
- Postal customers need service selection, customs declaration data, S10 identity, and event tracking.
- Postal operators need receptacle, dispatch, consignment, handover, and EDI-event reconciliation.
- Insurance teams need governed products, quote evidence, premium status, claim evidence, decisions, and settlement audit.
- Product owners need measurable funnel and failure signals, not development-phase labels or generic status pages.

### Product risks addressed

- Deny-by-default permission checks and tenant filters apply to every new endpoint.
- Customer views expose only owned postal items, insurance records, and freight resources.
- State changes use explicit transition endpoints and optimistic versions.
- Published/issued transport evidence is revised or superseded, not silently overwritten.
- Unknown rate or insurance eligibility fails to review; the system does not fabricate coverage or price.
- The dashboard separates commercial backlog, physical-flow exceptions, customs holds, insurance claims, postal delay, and financial blocks.

### Acceptance outcome

The Phase 13 implementation is acceptable as an extensible international logistics platform foundation when all automated gates pass. Production activation remains feature-flagged and adapter-specific. A tenant must not enable a regulated capability until the external dependency checklist below is satisfied.

## External dependencies and remaining production gates

These are not missing CRUD features; they require authority or networks outside the repository:

- Load a licensed UN/LOCODE dataset under its terms and maintain update/reconciliation evidence.
- Use GS1-issued company prefixes for SSCC, GINC, GSIN, and GLN identifiers.
- Contract with licensed insurers/brokers and bind their product wording, territorial limits, sanctions rules, and claims interfaces.
- Connect national customs/single-window systems using the applicable WCO Data Model subset and local message implementation.
- Obtain UPU/operator exchange credentials and bilateral/multilateral agreements for real postal EDI, IMPC routing, and S10 allocation.
- Implement carrier/DCSA/IATA/rail provider adapters and contractual event mappings.
- Add certified dangerous-goods rule/content providers for IMDG, IATA DGR, RID, and ADR decisions; the platform stores evidence but does not certify a shipment.
- Complete country privacy, retention, tax, insurance, e-document, and electronic-signature legal review.
- Validate sanctions/export controls, restricted-party screening, commodity classification, and export licensing with authoritative providers.
- Run provider sandbox, backup/restore, security, penetration, load, and disaster-recovery drills before production enablement.

## Prioritized follow-on backlog

1. Provider adapters: customs, insurer, postal EDI, carrier schedules/events, sanctions, and dangerous goods.
2. Master/house document UX and digital-signature/eBL registry integration.
3. Barcode-label printing and mobile scan/offline workflows for hubs and postal exchanges.
4. Container/equipment interchange, seal history, demurrage/detention, and yard appointment operations.
5. Tariff, duties/taxes, landed-cost, and customs broker work allocation.
6. Claims reserve accounting, subrogation, surveyor assignment, and insurer bordereaux.
7. Postal rates, address validation, delivery rounds, undeliverable/return-to-sender, and remuneration/terminal-dues adapters.
8. IoT/GPS provider ingestion with consent, retention, confidence, and sensor calibration evidence.
9. Network schedule optimization using actual sailing/flight/rail calendars and capacity commitments.
10. Formal conformance suites for each selected external standard profile and jurisdiction.
