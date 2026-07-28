# Development

Copy `.env.example` to `.env`, enable Corepack, install with the frozen lockfile,
and generate Prisma Client. Use `make dev` for the Compose stack or `pnpm dev`
when infrastructure is already running.

```bash
corepack enable
corepack prepare pnpm@11.15.1 --activate
pnpm install --frozen-lockfile
pnpm db:generate
cp .env.example .env
make dev
```

Database migrations run once through the Compose `migrate` job. Application
replicas never perform schema migration during startup.

After startup, load the idempotent demo data:

```bash
docker compose run --rm migrate pnpm db:seed
```

Useful commands are documented in the root `Makefile` and `README.md`. New
contributors should then follow the
[continuation guide](continuation-guide.md), which records the current phase,
validated paths, architectural invariants, known lessons, and next work.

Run `pnpm test:phase12:live` for the local freight request-to-POD journey. Use
`/dashboard` for cross-domain analytics, `/freight` for customer
requests/quotes/invoices/bookings, and `/operations/freight`,
`/operations/dispatch`, and `/operations/billing` for operator workflows.
Freight tracking is a milestone timeline, not live GPS.
