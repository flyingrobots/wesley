# Backlog

Items tracked from PR reviews, retrospectives, and ongoing development.

## Refactoring

- [ ] Extract shared Ajv validator helper and `resolveRepoRoot()` utility into a `@wesley/cli-utils` package (consolidates 5+ commands that duplicate Ajv init/schema-load/compile/error-wrap and fragile `process.env.WESLEY_REPO_ROOT || process.cwd()` pattern)
- [ ] Consolidate RESERVED keyword set: merge `emit.mjs` local copy into `identifiers.mjs`, update to PostgreSQL 16 fully-reserved list
- [x] Centralize `sanitizeIdentBase` 63-char truncation in `identifiers.mjs` and remove duplicate in `emit.mjs`
- [x] Replace `Buffer` usage in `Cursor.mjs` with `TextEncoder`/`btoa` for platform-agnostic `@wesley/core`

## Testing

- [ ] Add "schema surface" integration test that validates all generated JSON artifacts against their JSON schemas
- [ ] Add cursor edge-case tests: null/undefined/primitive inputs to `encodeCursor`/`decodeCursor`
- [ ] Add complementary join diagnostics test proving qualified refs (`'a.id'`, `{table,column}` form) do not throw
- [ ] Add LIKE and CONTAINS operator tests (positive + negative paths) mirroring existing IN/ILIKE cases
- [ ] Add negative-path cert tests: wrong key type, missing key, corrupt SHIPME format
- [ ] Add `--strict-ident` integration test that round-trips all PostgreSQL 16 reserved keywords

## Infrastructure

- [ ] Vendor Bats plugins (`bats-support`, `bats-assert`, `bats-file`) into `test/vendor/` to eliminate transient CI clone failures
