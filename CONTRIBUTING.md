# Contributing

Use short-lived branches and conventional commits. Before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose config
```

Schema changes require a committed migration, deploy/rollback notes, and tests
against both a clean and populated database. Protected commands and repositories
must include tenant scope and authorization tests.

## Before starting a feature

1. Read the [continuation guide](docs/development/continuation-guide.md).
2. Confirm the current boundary in [implementation status](IMPLEMENTATION_STATUS.md).
3. Read the relevant ADR and domain document.
4. Resolve or explicitly record any product decision that would otherwise be
   guessed.

## Pull-request documentation

Every domain pull request must update documentation in the same change:

- business rules and API/event contracts;
- schema/migration and operational notes;
- permissions, tenant-isolation, audit, and idempotency behavior;
- known limitations and mock integrations;
- `IMPLEMENTATION_STATUS.md` when evidence changes;
- `docs/testing/verification-record.md` with commands actually run;
- `CHANGELOG.md` for notable behavior.

Do not mark a phase complete because a route, table, interface, or mock exists.
Use the cross-phase definition of done in the
[phase roadmap](docs/product/phase-roadmap.md#cross-phase-definition-of-done).
