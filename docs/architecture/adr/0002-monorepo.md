# ADR 0002: pnpm and Turborepo monorepo

Status: Accepted.

Use pnpm workspaces for deterministic dependency management and Turborepo for
task ordering and caching. Package public exports are the only cross-package boundary.
