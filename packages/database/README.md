# @logicommerce/database

Prisma schema, migrations, client lifecycle, seed data, and tenant-scope helpers.
Application modules must use repositories rather than importing Prisma in controllers.

Production uses `prisma migrate deploy`; destructive schema synchronization is forbidden.
