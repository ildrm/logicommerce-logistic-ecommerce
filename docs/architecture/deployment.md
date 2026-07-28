# Deployment

Development and single-host deployments use Compose. Images use multi-stage
builds and non-root runtime users. Production must supply external secrets,
TLS, backups, monitoring, resource limits, and an approved migration window.
The repository is container-orchestrator compatible but does not claim a tested
Kubernetes deployment.

Freight activation additionally requires S3-compatible storage, public HTTPS
payment-webhook reachability, Stripe and/or Coinbase credentials accepted for
the tenant legal entity, provider reconciliation/refund drills, and coordinated
database/object-store recovery evidence. The mock payment adapter is forbidden
in production. No production SMTP, GPS, malware-scanning, or customs provider
is bundled.
