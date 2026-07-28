# Documentation map

This directory is the durable project memory for LogiCommerce. A developer who
has just cloned the repository should read the documents in this order:

1. [Continuation guide](development/continuation-guide.md) — exact current
   state, setup, guardrails, and the next implementation slice.
2. [Implementation status](../IMPLEMENTATION_STATUS.md) — authoritative phase
   status; this is the source of truth for what may be called complete.
3. [Phase roadmap](product/phase-roadmap.md) — implemented requirements and
   exit criteria for Phases 1–13.
4. [Acceptance scenarios](product/acceptance-scenarios.md) — product journeys
   A–J and their current evidence boundary.
5. [Verification record](testing/verification-record.md) — commands and live
   scenarios that passed on the last handoff.
6. [Open decisions](open-decisions.md) — business or production choices that
   must not be silently guessed.

## Architecture

- [System context](architecture/system-context.md)
- [Container architecture](architecture/container-architecture.md)
- [Module boundaries](architecture/module-boundaries.md)
- [Data ownership](architecture/data-ownership.md)
- [Entity relationships](architecture/entity-relationship.md)
- [Event architecture](architecture/event-architecture.md)
- [Security boundaries](architecture/security-boundaries.md)
- [Deployment](architecture/deployment.md)
- [Disaster recovery](architecture/disaster-recovery.md)
- [Architecture decision records](architecture/adr/)

## Product and domain

- [Phase roadmap](product/phase-roadmap.md)
- [Acceptance scenarios](product/acceptance-scenarios.md)
- [B2C boundary](business/b2c.md)
- [C2C boundary](business/c2c.md)
- [B2B boundary](business/b2b.md)
- [1PL–5PL capability map](logistics/1pl-5pl-capability-map.md)
- [Freight journey timeline](logistics/freight-journey-timeline.md)
- [International logistics system audit](product/international-logistics-system-audit.md)
- [Phase 13 PRD](product/phase13-international-logistics-prd.md)
- [International standards and object map](logistics/international-standards-map.md)
- [Panel navigation](ux/panel-navigation.md)
- [Design system](ux/design-system.md)

## Engineering and operations

- [Getting started](development/getting-started.md)
- [Continuation guide](development/continuation-guide.md)
- [Technology versions](technology-versions.md)
- [API guidelines](api/api-guidelines.md)
- [Webhook conventions](api/webhooks.md)
- [Threat model](security/threat-model.md)
- [Permission matrix](security/permission-matrix.md)
- [Static-analysis triage](security/static-analysis.md)
- [Phase 11 hardening review](security/hardening-2026-07/hardening.md)
- [Production readiness controls](operations/production-readiness.md)
- [Backup and restore runbook](operations/backup-restore-runbook.md)
- [Incident, rollout, and key-rotation runbook](operations/incident-rollout-runbook.md)
- [Freight, payment, and driver-coordination runbook](operations/phase12-freight-payments-runbook.md)
- [International logistics operations runbook](operations/international-logistics-runbook.md)
- [Verification record](testing/verification-record.md)
- [Documentation audit](testing/documentation-audit-2026-07-28.md)

## Documentation rules

- Update `IMPLEMENTATION_STATUS.md` in the same pull request that changes a
  phase status.
- Record consequential technical decisions as ADRs before making the decision
  difficult to reverse.
- Update the verification record only with commands that actually ran.
- Keep `KNOWN LIMITATIONS` honest. Scaffolding, mock adapters, and interfaces
  are not completed business modules.
- Add domain-specific ERDs and event catalogs as each phase introduces data.
