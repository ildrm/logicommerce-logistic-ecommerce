# @logicommerce/database

Prisma schema, migrations, client lifecycle, seed data, and tenant-scope helpers.
Application modules must use repositories rather than importing Prisma in controllers.

Production uses `prisma migrate deploy`; destructive schema synchronization is forbidden.

The schema includes all Phase 0–13 aggregates. Quote revisions, transport
milestones, driver check-ins, payment receipts, stock/finance ledgers, audit,
and outbox records are evidence-bearing history and require append,
supersession, or compensation semantics.

Phase 13 is introduced by
`202607280002_phase13_international_logistics` and
`202607280003_phase13_insurance_versions`. It adds international reference
data, transport parties/consignments/documents/customs, cargo insurance and
claims, hubs/handling units/consolidation/linehaul, and postal exchange.
