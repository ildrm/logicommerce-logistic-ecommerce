# MySQL operations

MySQL 8.4 uses InnoDB, UTC application timestamps, and utf8mb4. Production must
configure encrypted backups, point-in-time recovery, least-privileged accounts,
and restore testing. Schema changes run only through the migration job.

Recovery verification includes tenant counts, non-negative inventory, balanced
journals, canonical invoice sequences, payment-event uniqueness, quote revision
chains, and booking milestone order. MySQL and S3-compatible document storage
must be restored to a consistent recovery point.
