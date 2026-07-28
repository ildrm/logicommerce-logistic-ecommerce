# International standards and object map

Last updated: 2026-07-28

This map explains which external concepts influence the Phase 13 design. It is an implementation alignment map, not a certificate of conformance.

| Domain                    | Authoritative structure                                                                                                                                                                                | LogiCommerce representation                                                                                    | Boundary                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Locations                 | [UNECE Recommendation 16 / UN/LOCODE](https://unlocode.unece.org/recommendation16/)                                                                                                                    | `InternationalCodeList`, `StandardLocation`; UN/LOCODE plus IATA, IMPC, GLN, functions, coordinates, time zone | Production imports require licensed/current reference data and reconciliation.                           |
| Multimodal data           | [UN/CEFACT Multi-Modal Transport Reference Data Model](https://unece.org/trade/uncefact/mainstandards)                                                                                                 | Parties, consignments, locations, documents, handling units, events, and movements are independent objects     | Message/profile conformance testing remains adapter-specific.                                            |
| Road document             | [UN/CEFACT eCMR D23B](https://service.unece.org/trade/uncefact/publication/Transport-Logistics/eCMR/HTML/011.htm)                                                                                      | Versioned `ECMR` transport document payload and lifecycle                                                      | Qualified signatures and national eCMR acceptance remain external.                                       |
| Customs                   | [WCO Data Model](https://www.wcoomd.org/DataModel)                                                                                                                                                     | Versioned filing envelope, direction, customs office, declaration payload, MRN, status, and authority response | Country single-window mappings and credentials remain adapters.                                          |
| Logistics identifiers     | [GS1 identification keys](https://www.gs1.org/standards/id-keys) and [GS1 Logistic Label Guideline](https://www.gs1.org/standards/gs1-logistic-label-guideline/1-3)                                    | SSCC validation for logistics units; fields for GLN, GINC, and GSIN                                            | Identifiers must use GS1-issued prefixes; the app is not an issuing authority.                           |
| Traceability              | [GS1 Global Traceability Standard](https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard)                                                                                    | Append-only custody/handling events, source, external key, time, location, condition, and actor                | EPCIS exchange is a future adapter.                                                                      |
| Maritime mass             | [IMO SOLAS verified gross mass](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx)                                                                                       | VGM mass, method, verifier, and timestamp; loading guard for packed sea containers                             | Scale certification and shipper authorization remain operational controls.                               |
| Dangerous goods           | [IMO dangerous goods / IMDG overview](https://www.imo.org/en/ourwork/safety/pages/dangerousgoods-default.aspx)                                                                                         | Structured dangerous-goods and declaration evidence on cargo, consignment, handling unit, and documents        | Classification, segregation, packaging, and acceptance need licensed rule content and trained personnel. |
| Ocean events/documents    | [DCSA Track & Trace](https://dcsa.org/standards/track-and-trace) and [DCSA Bill of Lading 3.0](https://dcsa.org/standards/bill-of-lading/documentation-bill-of-lading-3/bill-of-lading-3-introduction) | Provider event/document standard and version fields; master references and equipment identifiers               | DCSA API conformance and carrier credentials are future adapters.                                        |
| Air cargo                 | [IATA ONE Record logistics objects](https://iata-cargo.github.io/ONE-Record/development/API-Security/logistics-objects/)                                                                               | Independent logistics objects and event links support an adapter mapping                                       | ONE Record server/client certification and IATA DGR are external.                                        |
| Postal identifiers/events | [UPU standards catalogue](https://www.upu.int/UPU/media/upu/documents/Standards/Catalogue-of-UPU-standards.pdf)                                                                                        | S10 item identity, IMPC routing, item events, and S32-style postal consignment field                           | Allocation rules, EDI messaging, and designated-operator credentials remain external.                    |
| Postal transport          | [UPU Postal Transport Guide](https://www.upu.int/UPU/media/upu/files/postalSolutions/programmesAndServices/postalSupplyChain/Transport/publications/guidePostalTransportEn.pdf)                        | Item → receptacle → dispatch → consignment hierarchy and handover events                                       | CARDIT/RESDIT/PREDES/RESDES transport exchange adapters remain future work.                              |
| Postal customs            | [WCO–UPU Postal Customs Guide](https://www.wcoomd.org/-/media/wco/public/global/pdf/topics/facilitation/instruments-and-tools/tools/upu/wco_upu-postal-customs-guide.pdf?la=en)                        | Postal customs payload and independent customs filing model                                                    | CN message generation and national postal-customs exchange remain adapters.                              |
| Trade terms/insurance     | [ICC Incoterms 2020](https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/)                                                                                                            | Incoterm on requests/consignments and explicit insurance coverage products                                     | Contract interpretation and current Institute Cargo Clauses wording require legal/provider control.      |

## Canonical hierarchy

```text
Customer request
  └─ Freight booking (commercial service commitment)
      ├─ Transport consignment(s) (goods moving under a contract)
      │   ├─ Transport/customs documents
      │   └─ Cargo insurance policy/claim
      └─ Cargo items
          └─ Handling unit(s): carton/pallet/cage/bag/ULD/container
              └─ Consolidation load
                  └─ Shared linehaul allocation

Postal item (S10)
  └─ Postal receptacle
      └─ Postal dispatch
          └─ Postal transport consignment
```

The hierarchy deliberately prevents one identifier or status from being used at every level.
