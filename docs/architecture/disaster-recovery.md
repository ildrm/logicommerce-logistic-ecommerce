# Disaster recovery

Target RPO is 15 minutes and RTO is 60 minutes. Production readiness requires
point-in-time MySQL backups, versioned object-storage replication, Redis treated
as reconstructable, quarterly restore drills, and a documented DNS/ingress
failover. These controls are designed but not yet production-tested.
