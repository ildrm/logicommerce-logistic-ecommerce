# Module boundaries

NestJS domain modules expose application services and ports. Controllers call
application services only; Prisma access is isolated behind repositories.
Cross-domain state changes use versioned domain events and the transactional
outbox. Direct imports across package internals are prohibited by public exports.

Initial implemented boundaries are configuration, tenancy context, audit,
domain events, database, validation, and deterministic logistics rules. Other
prompt domains remain explicitly tracked in `IMPLEMENTATION_STATUS.md`.
