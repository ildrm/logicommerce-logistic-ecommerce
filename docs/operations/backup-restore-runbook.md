# Backup and restore runbook

## Preconditions

Confirm incident ownership, tenant impact, target recovery point, encryption-key
availability, backup checksum, schema version, and an isolated restore
environment. Never restore over the active production database.

## Procedure

1. Freeze writes through ingress maintenance mode and record the start time.
2. Restore the latest full MySQL backup into an isolated database.
3. Apply encrypted incremental logs up to the approved recovery point.
4. Restore versioned object storage to the same approved recovery point.
5. Verify the backup checksum, migration table, tenant counts, journal balance,
   non-negative inventory, quote revision chains, payment-event uniqueness,
   milestone ordering, invoice/PDF and freight/POD object references, and
   outbox continuity.
6. Start one API and worker replica against the restored database with outbound
   webhooks and provider adapters disabled.
7. Run smoke journeys for authentication, order reads, inventory, finance,
   freight booking/timeline reads, invoice documents, and tenant isolation.
8. Record measured RPO/RTO and evidence through the recovery-exercise API.
9. Obtain incident-commander and data-owner approval before changing traffic.

Rollback redirects traffic to the untouched original database when it remains
authoritative. If writes occurred after cutover, stop and reconcile them; never
merge financial or inventory ledgers by overwriting rows.

Quarterly exercises use synthetic data and a production-equivalent topology.
Evidence includes backup identity, checksum, timestamps, migration status,
verification output, approvers, and follow-up actions.
