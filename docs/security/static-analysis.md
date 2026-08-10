# Static-analysis triage

The senior-fullstack quality analyzer was run against the repository on
2026-07-21. Its pattern-based scan reported six security candidates. Manual
review found all six to be false positives:

- Three findings are in Prisma-generated code. The scanner matched the
  `PASSWORD` enum name and Prisma's generated raw-query APIs; generated code is
  excluded from source control and is not edited locally.
- The application finding matched the `%s` placeholder in the Next.js metadata
  title template. It is not a SQL statement or query input.

The scanner's estimated 11% test coverage was directional rather than measured.
That historical scan is not current coverage evidence. Domain-critical release
criteria still require a generated, archived report demonstrating at least 80%
coverage; repository-level phase tests do not substitute for it.

## Expiring runtime acceptance — CVE-2026-12151

The 2026-08-10 image gate identified undici 6.26.0 embedded in Node.js 24.19.0,
the current upstream LTS release. CVE-2026-12151 affects unbounded WebSocket
receive buffering. LogiCommerce exposes no WebSocket endpoint and does not use
undici's WebSocket client, so the affected path is not reachable in the current
runtime. Package managers and their unused dependency trees are removed from
all final images.

The narrowly scoped `.trivyignore.yaml` acceptance expires on 2026-09-03.
Platform/security owns replacement with the first Node.js 24 release embedding
undici 6.27.0 or later. Expiry restores the fail-closed image gate automatically;
the acceptance must not be extended without a new reachability review.
