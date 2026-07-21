# ADR 0001: Modular monolith

Status: Accepted.

Use explicit bounded contexts inside one deployable API codebase, plus separate
web and worker processes. Extract services only for independent scaling,
security, ownership, availability, or regulatory needs.
