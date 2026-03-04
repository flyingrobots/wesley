# Backlog

Items tracked from PR reviews, retrospectives, and ongoing development.

## Refactoring

- [x] Extract shared Ajv validator helper and `resolveRepoRoot()` utility (now `schemaValidator.mjs` in `@wesley/cli/framework`; consolidates 5+ commands)
- [ ] Consolidate RESERVED keyword set: merge `emit.mjs` local copy into `identifiers.mjs`, update to PostgreSQL 16 fully-reserved list
- [x] Centralize `sanitizeIdentBase` 63-char truncation in `identifiers.mjs` and remove duplicate in `emit.mjs`
- [x] Replace `Buffer` usage in `Cursor.mjs` with `TextEncoder`/`btoa` for platform-agnostic `@wesley/core`

## Testing

- [ ] Add "schema surface" integration test that validates all generated JSON artifacts against their JSON schemas
- [x] Add cursor edge-case tests: null/undefined/primitive inputs to `encodeCursor`/`decodeCursor`
- [x] Add complementary join diagnostics test proving qualified refs (`'a.id'`, `{table,column}` form) do not throw
- [x] Add LIKE and CONTAINS operator tests (positive + negative paths) mirroring existing IN/ILIKE cases
- [ ] Add negative-path cert tests: wrong key type, missing key, corrupt SHIPME format
- [ ] Add `--strict-ident` integration test that round-trips all PostgreSQL 16 reserved keywords

## Schema

- [ ] `schemas/qir.schema.json` uses `QueryPlan: { "$ref": "#" }` as a root self-reference, which may confuse external JSON Schema tooling (e.g., code generators, IDE validators) that do not handle recursive `$ref` to root. Consider introducing a named `$defs/QueryPlan` definition and referencing that instead.

## Infrastructure

- [ ] Vendor Bats plugins (`bats-support`, `bats-assert`, `bats-file`) into `test/vendor/` to eliminate transient CI clone failures
