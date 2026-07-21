# Assumptions

- Product identity is **LogiCommerce** and the repository remains at the current root.
- Launch architecture is a modular monolith owned by an assumed 12-person team growing to 20.
- Target cadence is weekly with a path to per-PR deployment after Phase 3.
- Year-one p99 traffic assumption is 250 requests/second, read/write ratio roughly 8:1.
- Monthly infrastructure/SaaS ceiling is assumed to be USD 20,000.
- Data is treated as regulated PII; raw payment instruments remain with licensed providers.
- The initial deployment target is one Docker host; production orchestration is an extension.
- English, USD, UTC, and United States are defaults, not hard-coded business constraints.
- Mock adapters are used for payment, tax, address validation, carrier, identity verification, and malware scanning.
- MySQL is the operational system of record; analytical workloads will be separated later.

## Verifiable targets

- API latency: p50 ≤ 50 ms, p95 ≤ 150 ms, p99 ≤ 400 ms for cached/read endpoints at design load.
- Web performance: mobile 4G LCP ≤ 2.0 s, INP ≤ 100 ms, CLS ≤ 0.1.
- Availability: 99.95% monthly SLO after production hardening.
- Recovery: RPO ≤ 15 minutes and RTO ≤ 60 minutes.
- Coverage: at least 80% on domain-critical packages before their phase exits.
