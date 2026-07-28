# International logistics operations runbook

Last updated: 2026-07-28

## Purpose

Operate Phase 13 reference data, transport documents/customs, cargo insurance, consolidation, shared linehaul, and postal exchange safely.

## Daily queues

1. Open `/dashboard` and review cargo insurance, handling, consolidation, postal, and customs signals.
2. Open `/operations/network` for missed cutoffs, handling-unit exceptions, capacity, and linehaul allocation.
3. Open `/operations/insurance` for submitted claims and policies awaiting premium.
4. Open `/operations/postal` for open/late dispatches and items held, lost, or damaged.
5. Confirm outbox dead letters and audit evidence before replaying any provider message.

## Handling and consolidation

- Scan or register the handling unit before allocating cargo.
- Verify the unit identifier, parent, gross mass, volume, current hub, condition, and contents.
- For packed sea containers, record VGM and method before loading.
- Do not add members after cutoff. A missed cutoff is an exception requiring replan or explicit cancellation.
- Close a consolidation only after member reconciliation.
- Load only non-empty units. Confirm seal and position where applicable.
- Allocate the consolidation to linehaul only within remaining weight/volume.
- At destination, record unload/open events, deconsolidate, reconcile short/over/damage, and release onward units.

## Cargo insurance

- Verify provider license/territory outside the demo environment.
- Select the exact immutable product version and confirm modes, route countries, currency, valuation basis, clauses, exclusions, deductible, and validity.
- Quote acceptance creates the premium invoice. Coverage remains `AWAITING_PAYMENT` until the required schedule is paid.
- On loss notice, confirm policy status, loss time within coverage, currency, claimed amount, location, description, and evidence.
- Use `INFO_REQUIRED` when evidence is incomplete. Record every decision and settlement as a claim event.
- Do not treat carrier liability as cargo all-risk insurance.

## Postal exchange

- Accept the item under an active product; validate S10 and required customs data.
- Load only compatible origin/destination/mail-category items into an open receptacle.
- Reconcile contents, weight, and seal before closing.
- Add only closed, route-compatible receptacles to an open dispatch.
- Close, hand over, and record transport events. Duplicate provider events must reuse their external key.
- At receipt, reconcile dispatch and receptacles before opening and generating item events.
- Escalate customs holds, damage, loss, and scheduled handover misses from the dashboard.

## Recovery

- State changes are version-checked. Reload after a conflict; never force an old version.
- Provider event replay must preserve the original external/event key.
- If a migration fails, stop application rollout and follow the backup/restore runbook.
- If an identifier source is corrupt, quarantine the import and restore the last verified code-list version.
- If payment succeeds but a policy remains blocked, reconcile the payment event/allocation, invoice source reference, and outbox before manual correction.

## Production activation checklist

- Tenant feature flag approved.
- Least-privilege roles assigned.
- Reference data provenance and checksum verified.
- Licensed provider and contractual adapter credentials verified.
- Webhooks/EDI signatures, replay protection, and clocks tested.
- Backup/restore and reconciliation drill passed.
- Country legal, customs, insurance, dangerous-goods, postal, privacy, and retention review signed off.
