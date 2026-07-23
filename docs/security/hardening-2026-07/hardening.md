# Security Hardening Review: LogiCommerce production boundary

## Evidence Basis

I inspected the repository threat model, Phase 11 roadmap, implementation plan,
ingress bootstrap, permission guard, audit model, and the new high-impact
finance and routing transitions. The threat model most strongly points to one
shared structural concern: evidence for privileged actions and operational
readiness must not live only in prose or mutable dashboards.

## Constraints

The modular monolith, tenant-scoped repositories, append-only ledgers, human
approval, Compose development topology, 99.95% availability target, 15-minute
RPO, and 60-minute RTO remain non-negotiable. No production load or recovery
measurement was supplied.

## Opportunity Portfolio

| Opportunity                                           | Evidence                                               | Options                                                      | Recommendation                                                       | Proposal                                             |
| ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Govern high-impact transitions and readiness evidence | Threat model and Phase 11 requirements (`E001`–`E004`) | Local documentation; central tenant-scoped evidence boundary | Use the central boundary while retaining focused ingress protections | [Proposal](proposals/govern-operational-evidence.md) |

## Recommendation Summary

I recommend the central evidence boundary under the current constraints. It
lets us apply the same tenant isolation, permission, state-transition, audit,
and retention rules to recovery, privacy, finance, and routing evidence. Local
runbooks remain necessary, but alone they cannot prove that an approval or
exercise happened.

## Next Decisions

Production owners still need to select durable telemetry, backup, secret
manager, and orchestration providers. Those choices should follow measured load
and recovery exercises, not repository assumptions.
