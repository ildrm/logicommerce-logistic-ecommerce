# Static-analysis triage

The senior-fullstack quality analyzer was run against the repository on
2026-07-21. Its pattern-based scan reported six security candidates. Manual
review found all six to be false positives:

- Three findings are in Prisma-generated code. The scanner matched the
  `PASSWORD` enum name and Prisma's generated raw-query APIs; generated code is
  excluded from source control and is not edited locally.
- The application finding matched the `%s` placeholder in the Next.js metadata
  title template. It is not a SQL statement or query input.

The scanner's estimated 11% test coverage is directional rather than measured;
coverage expansion remains a valid Phase 11 requirement. Domain-critical phase
exit criteria require measured coverage of at least 80%.
