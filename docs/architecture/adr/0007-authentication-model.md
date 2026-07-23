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

Email verification, password reset, and passwordless login use
cryptographically random, purpose-bound, expiring, single-use tokens. Persist
only an HMAC-SHA-256 token hash. Return the same request response whether an
identity exists to reduce account enumeration. Development may use a labeled
in-memory delivery adapter; production must fail closed until a real mail
adapter is configured.

TOTP is the initial MFA method. Encrypt TOTP secrets at rest with AES-256-GCM
under a dedicated field-encryption key, accept a one-step clock window, and
atomically retain the last accepted step to prevent replay. Recovery codes are
random, HMAC-hashed, disclosed once, and consumed atomically.

External OIDC and social providers implement the provider-neutral identity port
and registry. No concrete provider is selected by this ADR. Provider choice,
client secrets, callback domains, assurance mapping, and account-linking policy
require an explicit deployment decision.

Machine credentials use a public prefix plus random secret. Persist only an
HMAC hash, require explicit scopes, support expiry and revocation, and never
return the secret after creation.
