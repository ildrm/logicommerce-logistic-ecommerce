# Data ownership

| Data                     | System of record                                | Mutation rule                      |
| ------------------------ | ----------------------------------------------- | ---------------------------------- |
| Tenant, identity, access | MySQL / identity-tenancy modules                | Transactional repositories         |
| Inventory                | Stock ledger plus transactional derived balance | Compensating entries only          |
| Finance                  | Double-entry journal                            | Balanced immutable postings        |
| Audit                    | Append-only audit event                         | No ordinary update/delete API      |
| Integration events       | Transactional outbox and consumer inbox         | Idempotent publication/consumption |
| Assets                   | S3-compatible storage with MySQL metadata       | Signed upload workflow             |

Tenant-owned rows carry `tenantId`; repository methods accept resolved tenant
context explicitly.
