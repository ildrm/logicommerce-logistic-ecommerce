# Data ownership

| Data                     | System of record                                 | Mutation rule                      |
| ------------------------ | ------------------------------------------------ | ---------------------------------- |
| Tenant, identity, access | MySQL / identity-tenancy modules                 | Transactional repositories         |
| Inventory                | Stock ledger plus transactional derived balance  | Compensating entries only          |
| Finance                  | Double-entry journal                             | Balanced immutable postings        |
| Freight demand/quotes    | Freight aggregates and immutable quote revisions | State transitions and supersession |
| Travel timeline          | Transport milestones and driver check-ins        | Append or idempotent ingest        |
| Billing                  | Canonical invoice, schedule, allocation records  | Issuance plus compensations        |
| Provider payments        | Durable payment sessions and event receipts      | Signed idempotent webhook handling |
| Audit                    | Append-only audit event                          | No ordinary update/delete API      |
| Integration events       | Transactional outbox and consumer inbox          | Idempotent publication/consumption |
| Assets                   | S3-compatible storage with MySQL metadata        | Signed upload workflow             |

Tenant-owned rows carry `tenantId`; repository methods accept resolved tenant
context explicitly.

Legacy B2B/3PL invoice rows remain compatibility data. New financial behavior
uses the canonical billing model; posted journals, published quotes, payment
events, milestones, and check-ins are not rewritten as correction shortcuts.
