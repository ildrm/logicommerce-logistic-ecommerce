# Documentation audit — 2026-07-28

## Scope

The audit reviewed all 71 Markdown files present after the Phase 13
documentation additions, covering root policies/status, application and
package READMEs, API guidance, architecture and ADRs,
business/product/logistics guidance, development handoff, operations,
security, testing evidence, UX, infrastructure, and the retained control-tower
mockup.

The code was treated as authoritative for freight bookings, transport
milestones, manual driver check-ins, proof of delivery, canonical billing,
payment providers, worker behavior, permissions, and web routes.
Phase 13 code and migrations were additionally treated as authoritative for
international locations, consignments, document/customs revisions, cargo
insurance and claims, handling-unit custody, consolidation/shared capacity,
postal exchange hierarchies, and international analytics.

## Corrections made

- Updated the continuation, implementation, roadmap, acceptance, application,
  package, architecture, API, security, operations, and UX documents from the
  pre–Phase 12 boundary to the current repository evidence.
- Corrected the driver-coordinator role from five permissions to the four
  permissions actually seeded.
- Added the specific
  [freight journey timeline](../logistics/freight-journey-timeline.md)
  specification and linked it from the primary documentation maps.
- Distinguished the implemented booking-milestone timeline from continuous GPS
  and from a future unified quote/payment/travel/exception lifecycle feed.
- Removed production overclaims: tenant freight feature flags, automated
  provider-session polling, production SMTP invoice delivery, and active
  malware scanning are documented as unimplemented.
- Clarified that historical changelog releases, ADRs, verification records, and
  Phase 11 hardening evidence describe their original review point and should
  not be rewritten as current implementation claims.
- Added the international expert audit, Phase 13 PRD, standards map, operating
  runbook, architecture/entity/event/permission updates, customer and
  operations route maps, acceptance scenario, and verification boundary.
- Kept external regulatory conformance, licensed identifiers/data, insurer and
  postal agreements, dangerous-goods decisions, and country customs adapters
  explicit as production dependencies rather than repository claims.

## Preserved historical documents

ADRs `0001`–`0007`, the `docs/security/hardening-2026-07/` review portfolio,
and dated sections of `docs/testing/verification-record.md` remain historical
evidence. They were checked for broken current navigation and unsafe
contradictions but their original findings and release-state claims were not
retroactively changed.

## Current truth boundary

Phases 0–13 have repository-level automated evidence. Production activation
still requires deployment-specific Stripe/Coinbase sandbox certification,
licensed international data and identifiers, insurer/customs/postal/carrier
agreements and adapters, jurisdictional review, public webhook and
reconciliation/refund drills, authorized security/SBOM and coverage evidence,
external penetration testing, and a production-equivalent
database/object-store restore exercise. SMTP invoice delivery, active upload
malware scanning, provider-session reconciliation polling, tenant freight
feature flags, continuous GPS, and external conformance certification are not
implemented.

Runtime evidence is recorded separately in
[verification-record.md](verification-record.md); this file records the
documentation review boundary.
