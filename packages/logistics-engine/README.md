# @logicommerce/logistics-engine

Deterministic, provider-independent inventory and routing rules. High-impact
recommendations are outputs for human approval, never autonomous commands.

Freight rate rules may produce a non-binding estimate only when a matching
lane/zone/mode/equipment rule exists. Missing pricing results in
`NEEDS_REVIEW`; it must never fabricate a price.
