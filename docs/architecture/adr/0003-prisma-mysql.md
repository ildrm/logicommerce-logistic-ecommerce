# ADR 0003: Prisma and MySQL

Status: Accepted.

Use MySQL 8.4 LTS with InnoDB/utf8mb4 and Prisma migrations. Controllers never
use Prisma directly. Sensitive invariants may use transactions or reviewed SQL.
