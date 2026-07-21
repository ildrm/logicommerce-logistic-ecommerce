# Deployment

Development and single-host deployments use Compose. Images use multi-stage
builds and non-root runtime users. Production must supply external secrets,
TLS, backups, monitoring, resource limits, and an approved migration window.
The repository is container-orchestrator compatible but does not claim a tested
Kubernetes deployment.
