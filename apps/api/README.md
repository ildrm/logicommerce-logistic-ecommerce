# API

NestJS 11 with Fastify. Controllers delegate to application services and all
tenant-owned repositories require resolved tenant context. Swagger is served at
`/api/docs`; health endpoints live outside the versioned business API.

The Phase 1 authentication boundary exposes local password login, refresh-token
rotation, current-user and session queries, and session/logout revocation under
`/api/v1/auth`. Browser refresh tokens are opaque and stay in an `HttpOnly`,
`SameSite=Strict` cookie; access tokens are returned as short-lived bearer
tokens. Local development may use an explicit tenant header as a bridge. In
production, verified tenant-domain mappings are authoritative and that header
is ignored. Login and refresh endpoints use
Redis-backed limits, and privileged endpoints declare permissions through the
deny-by-default authorization guard.
