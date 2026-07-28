# Assumptions

- Product identity is **LogiCommerce** and the repository remains at the current root.
- Launch architecture is a modular monolith owned by an assumed 12-person team growing to 20.
- Target cadence is weekly with a path to per-PR deployment after Phase 3.
- Year-one p99 traffic assumption is 250 requests/second, read/write ratio roughly 8:1.
- Monthly infrastructure/SaaS ceiling is assumed to be USD 20,000.
- Data is treated as regulated PII; raw payment instruments remain with licensed providers.
- The initial deployment target is one Docker host; production orchestration is an extension.
- English, USD, UTC, and United States are defaults, not hard-coded business constraints.
- The synchronous payment mock is local/test-only. Stripe Checkout and Coinbase
  Business Checkout adapters are implemented but require deployment sandbox
  certification and secrets.
- Tax, address validation, carrier, and identity verification use replaceable
  development adapters. Upload quarantine metadata exists, but an active
  production malware-scanning service is not bundled.
- MySQL is the operational system of record; analytical workloads will be separated later.
- Freight location history is reported through milestones and manual check-ins;
  continuous GPS and browser geolocation are outside the current boundary.
- International reference-data rows in the seed are demonstration subsets,
  not licensed authoritative distributions. Production uses verified imports,
  version provenance, and checksums.
- The repository is not an insurer, GS1 issuing organization, customs
  authority, or designated postal operator. Regulated functions require
  licensed providers, identifiers, credentials, agreements, and country review.
- Postal transport uses the item/receptacle/dispatch/consignment structure.
  Real UPU EDI and remuneration are provider/operator adapter boundaries.
- Dangerous-goods and customs fields capture evidence; they do not replace
  certified classification, acceptance, screening, or filing services.

## Verifiable targets

- API latency: p50 ≤ 50 ms, p95 ≤ 150 ms, p99 ≤ 400 ms for cached/read endpoints at design load.
- Web performance: mobile 4G LCP ≤ 2.0 s, INP ≤ 100 ms, CLS ≤ 0.1.
- Availability: 99.95% monthly SLO after production hardening.
- Recovery: RPO ≤ 15 minutes and RTO ≤ 60 minutes.
- Coverage: at least 80% on domain-critical packages before their phase exits.
