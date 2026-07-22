# ADR 0007: Authentication and browser session model

Status: Accepted.

Use tenant-local Argon2id password identities for the first authentication
slice while preserving provider-neutral identity records for later OIDC and
social providers.

Issue short-lived HS256 access tokens containing only actor, tenant, session,
role, and permission claims. Validate the token signature, issuer, audience,
expiry, tenant binding, and active database session on every protected request.
The symmetric signing secret is an operational secret and must be rotated
through the production secrets manager when that provider is selected.

Use cryptographically random opaque refresh tokens. Store only a SHA-256 hash
combined with a server-side pepper, rotate on every use, and retain consumed
token records so reuse can revoke the complete token family and its session.
Browser refresh tokens are returned only as `HttpOnly`, `SameSite=Strict`
cookies, with `Secure` required in production. The web application and API are
served through the same reverse-proxy origin; this same-site deployment and
POST-only mutation model is the initial CSRF boundary. Revisit the protection
before allowing cross-site browser clients.

Logout and session revocation take effect immediately because bearer-token
authentication checks the referenced session in the database rather than
trusting a valid JWT until expiry.
