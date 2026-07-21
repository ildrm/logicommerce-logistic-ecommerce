# ADR 0006: Inventory and financial ledgers

Status: Accepted.

Inventory and finance use immutable ledger entries with transactionally derived
balances. Corrections are compensating entries; mutable order totals never define settlements.
