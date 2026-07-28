# Disaster recovery

Target RPO is 15 minutes and RTO is 60 minutes. Production readiness requires
point-in-time MySQL backups, versioned object-storage replication, Redis treated
as reconstructable, quarterly restore drills, and a documented DNS/ingress
failover. These controls are designed but not yet production-tested.

Database and object storage must be restored to a mutually consistent point.
Verification includes invoice/PDF and freight/POD object references, document
checksums, quote revision chains, booking milestone order, payment-event
deduplication, balanced journals, non-negative inventory, and outbox continuity.
