# Backlog

Items tracked from PR reviews, retrospectives, and ongoing development.

## Refactoring

- [ ] Extract shared Ajv validator helper from cert-verify/plan/rehearse/generate/qir-validate (5+ commands duplicate Ajv init/schema-load/compile/error-wrap boilerplate)
- [ ] Create `resolveRepoRoot()` utility using `import.meta.url` to replace fragile `process.env.WESLEY_REPO_ROOT || process.cwd()` pattern across commands
- [ ] Consolidate RESERVED keyword set: merge `emit.mjs` local copy into `identifiers.mjs`, update to PostgreSQL 16 fully-reserved list
- [ ] Centralize `sanitizeIdentBase` 63-char truncation in `identifiers.mjs` and remove duplicate in `emit.mjs`
- [ ] Replace `Buffer` usage in `Cursor.mjs` with `TextEncoder`/`btoa` for platform-agnostic `@wesley/core`

## Testing

- [ ] Add "schema surface" integration test that validates all generated JSON artifacts against their JSON schemas
- [ ] Add cursor edge-case tests: null/undefined/primitive inputs to `encodeCursor`/`decodeCursor`
- [ ] Add complementary join diagnostics test proving qualified refs (`'a.id'`, `{table,column}` form) do not throw
- [ ] Add LIKE and CONTAINS operator tests (positive + negative paths) mirroring existing IN/ILIKE cases

## Ideas

- [ ] Create a `@wesley/cli-utils` package exporting shared `createSchemaValidator()` and `resolveRepoRoot()`
- [ ] Replace `Buffer` in `Cursor.mjs` with `TextEncoder`/`btoa` for true platform agnosticism
- [ ] Add a "schema surface" integration test that validates all generated JSON artifacts against their schemas
