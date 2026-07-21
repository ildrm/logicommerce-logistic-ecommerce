# Container architecture

The core stack contains `web`, `api`, `worker`, `migrate`, MySQL, Redis, MinIO,
Mailpit, and Nginx. Only Nginx is intended to be public in production. The API
and worker share application modules but run as independent processes. The
migration job must succeed before API and worker startup.

```mermaid
flowchart LR
  Browser --> Nginx
  Nginx --> Web
  Nginx --> API
  API --> MySQL
  API --> Redis
  API --> MinIO
  Worker --> MySQL
  Worker --> Redis
  Migrate --> MySQL
  API --> Mailpit
```

`compose.yaml` defines the secure core topology. `compose.dev.yaml` exposes
developer ports for MySQL, Redis, MinIO, and Mailpit. `compose.prod.yaml` applies
production environment flags and resource limits but is not a complete
production orchestrator. Secrets, TLS termination, backups, scheduling,
autoscaling, and multi-host recovery remain deployment decisions.
