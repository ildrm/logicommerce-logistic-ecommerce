# API

NestJS 11 with Fastify. Controllers delegate to application services and all
tenant-owned repositories require resolved tenant context. Swagger is served at
`/api/docs`; health endpoints live outside the versioned business API.

The tested Phase 1 boundary exposes password and passwordless login, email
verification/reset, TOTP/recovery MFA, rotating sessions, and revocation under
`/api/v1/auth`. Tenant-scoped role, grant, user-role, and machine-credential
administration lives under `/api/v1/identity`. Browser refresh tokens are
opaque and stay in an `HttpOnly`, `SameSite=Strict` cookie; access tokens are
short-lived bearer tokens. Verified tenant-domain mappings are authoritative
in production. Redis-backed rate limits fail closed, privileged endpoints use
the deny-by-default permission guard, machine endpoints require declared
scopes, and security-sensitive changes are audited.

Development uses a labeled in-memory identity-mail adapter. Production requires
a real adapter. OIDC/social providers plug into the provider-neutral identity
port; no external vendor is bundled.

The implemented API also covers catalog and commerce, fulfillment, C2C, B2B,
partner APIs, returns/finance, 3PL–5PL operations, analytics, global freight,
dispatch, canonical billing, and payment webhooks. Freight bookings return
ordered legs, chronological milestones, assignment check-ins, exceptions, and
proof-of-delivery evidence. Stripe and Coinbase completion is webhook-driven;
the synchronous payment mock is development/test-only and fails closed in
production.

Phase 13 APIs add `/international-logistics`, `/logistics-network`,
`/insurance`, and `/postal`. They separate parties/consignments/documents and
customs, physical handling units and consolidation/shared linehaul, premium
invoicing and claims, and postal item/receptacle/dispatch/consignment events.
Every customer read is ownership-scoped; every operations route has an
explicit permission.
