# MySQL operations

MySQL 8.4 uses InnoDB, UTC application timestamps, and utf8mb4. Production must
configure encrypted backups, point-in-time recovery, least-privileged accounts,
and restore testing. Schema changes run only through the migration job.
