# Technology versions

Verified on 2026-07-21 against official release channels and the npm registry.
The lockfile, rather than this snapshot, remains authoritative. Documentation
was reviewed on 2026-07-28 without changing the selected dependency lines.

| Component         |        Selected | Rationale                                                                                 |
| ----------------- | --------------: | ----------------------------------------------------------------------------------------- |
| Node.js           |     24 LTS line | Prisma-supported LTS; containers avoid local Node 26 Current.                             |
| pnpm              |         11.15.1 | Current stable package manager.                                                           |
| Next.js           |         16.2.10 | Latest stable 16.2 patch; 16.3 was still preview.                                         |
| React / React DOM |          19.2.7 | Current stable and supported by Next 16.2.                                                |
| NestJS            |         11.1.28 | Current stable.                                                                           |
| TypeScript        |           5.9.3 | Mature stable line; selected instead of newly released 7.0.2 for ecosystem compatibility. |
| Prisma ORM        |           7.9.0 | Current production-recommended Prisma 7 GA line; Prisma Next remains early access.        |
| Tailwind CSS      |           4.3.0 | Current stable feature line.                                                              |
| Vitest            |          4.1.10 | Current stable.                                                                           |
| Playwright        |          1.61.1 | Stable release; 1.62 builds were alpha at verification time.                              |
| MySQL             |    8.4 LTS line | Requested LTS family.                                                                     |
| Redis             | 8.2 stable line | Cache and queue backend.                                                                  |

Package manifests use exact dependency versions. `pnpm-lock.yaml` is the final
source of resolved transitive versions.

External payment contracts target Stripe hosted Checkout fulfillment through
signed webhooks and Coinbase Business Checkouts. Provider API behavior and
signature rules must be revalidated against official documentation during each
deployment certification.
