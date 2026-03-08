# Architecture Audit — Immediate Priority

Results of a comprehensive hexagonal architecture, SOLID, DRY, and test quality
audit conducted 2026-03-08. All four items are **immediate priority**.

---

## ARC-1 — Consolidate Duplicated Generators (2,029 lines)

Three generators exist as byte-for-byte copies in both `wesley-core` and
`wesley-generator-supabase`. Every bug fix or enhancement must be applied twice.

| Generator | Lines (per copy) | Core Location | Supabase Location |
|---|---|---|---|
| `RepairGenerator` | 831 | `core/src/domain/generators/RepairGenerator.mjs` | `generator-supabase/src/repair.mjs` |
| `TriggerGenerator` | 599 | `core/src/domain/generators/TriggerGenerator.mjs` | `generator-supabase/src/trigger.mjs` |
| `RollbackGenerator` | 599 | `core/src/domain/generators/RollbackGenerator.mjs` | `generator-supabase/src/rollback.mjs` |

**Plan:**
- [x] Decide canonical home (core vs generator-supabase vs shared package)
  → Canonical home is `wesley-core`. Supabase copies were dead code (not imported/exported).
- [x] Make the non-canonical location import and re-export from canonical
  → N/A — supabase copies were unused.
- [x] Verify all tests pass with single source of truth
- [x] Remove the duplicate source files

---

## ARC-2 — Create `@wesley/test-fixtures` Package

~5,000 lines of inline GraphQL test schemas (User, Product, Order, Org) are
duplicated across ~90 test files. `MockDatabase`, `testFixtures`, and `dbAssert`
live in `wesley-core/test/helpers/` but aren't available to other packages.

**Plan:**
- [x] Create `packages/wesley-test-fixtures/` with `package.json`
- [x] Move `MockDatabase`, `testFixtures`, `dbAssert` from `wesley-core/test/helpers/database.mjs`
  → Re-exported via `@wesley/test-fixtures/database`; originals kept in place for zero-disruption.
- [x] Move `propertyHelpers`, `sqlGenerators` from `wesley-core/test/helpers/property-testing.mjs`
  → Re-exported via `@wesley/test-fixtures/property-testing`; originals kept in place.
- [x] Add parameterized schema builders: `simpleUser()`, `ecommerce()`, `multiTenant()`, `allDataTypes()`, etc.
- [ ] Migrate test files to import from `@wesley/test-fixtures` instead of inline definitions
- [ ] Add tests for untested packages (`generator-js`, `host-bun`, `scaffold-multitenant`, `slaps`)

---

## ARC-3 — Consolidate Error Hierarchies into Shared `DomainError`

Three modules independently define identical error base class patterns
(~250 lines total duplication):

- `ConcurrentSafetyAnalyzer` → `ConcurrentSafetyError` + 2 subclasses
- `BackpressureController` → `BackpressureError` + 3 subclasses
- `SafetyValidator` → `SafetyValidationError` + 3 subclasses

All follow identical constructor: `(message, code, context = {})`.

**Plan:**
- [x] ~~Create `packages/wesley-core/src/domain/errors/DomainError.mjs` with shared base class~~
  → `WesleyError` already exists at `packages/wesley-core/src/domain/WesleyError.mjs` with
    `(code, message, meta)` — used that instead.
- [ ] Define reusable subclass categories: `ValidationError`, `ConflictError`, `ResourceError`
- [x] Migrate `ConcurrentSafetyAnalyzer` errors to extend `WesleyError`
- [x] Migrate `BackpressureController` errors to extend `WesleyError`
- [x] Migrate `SafetyValidator` errors to extend `WesleyError`
- [ ] Extract domain event lifecycle boilerplate into a factory (Started/Completed/Failed pattern repeated in 5+ modules)

---

## ARC-4 — Fix Command Auto-Discovery (Open/Closed Violation)

`packages/wesley-cli/src/commands.mjs` manually imports each command file despite
`AutomaticallyRegisteredProgram` already supporting auto-registration via import
side effects. Adding a command requires editing `commands.mjs`.

**Plan:**
- [x] Replace hardcoded imports with directory scanning (`readdirSync` + dynamic `import()`)
  → `program.mjs` now uses `discoverCommands()` which scans `commands/` directory,
    dynamically imports all `.mjs` files (skipping `_`-prefixed helpers and `index.mjs`),
    and instantiates any export that extends `WesleyCommand`.
- [x] Verify all existing commands still register correctly
- [ ] Add a test: dropping a new `.mjs` file in `commands/` auto-registers without editing `commands.mjs`

---

## Backlog — Additional Audit Findings

Lower priority items identified in the same audit. Not blocking, but worth
scheduling after the immediate items above.

### SRP — God Objects to Decompose

These classes exceed 750 lines with 40+ methods spanning 5-6 responsibilities
each. Should be split into focused collaborators behind a facade.

- [ ] `ConcurrentSafetyAnalyzer` (1,081 lines) → RaceConditionDetector, LockConflictAnalyzer, DependencyGraphBuilder, ExecutionStrategyGenerator, SafetyScorer
- [ ] `BackpressureController` (793 lines) → CircuitBreaker, AdaptiveRateLimiter, PoolMonitor, RecoveryManager
- [ ] `RepairGenerator` (831 lines) → SafeOperationFilter, RepairStepGenerator, RepairSQLGenerator, RollbackPlanner
- [ ] `SafetyValidator` (782 lines) → ConcurrentOperationValidator, ResourceLimitValidator, PermissionValidator
- [ ] `DifferentialValidator` (634 lines) → SchemaDriftDetector, DiffReportGenerator, ImpactAssessor

### Dependency Inversion

- [ ] Domain classes extend concrete `EventEmitter` — extract `EventPublisher` port, inject via constructor
- [ ] `RepairGenerator` instantiates `new MigrationSafety()` directly — accept via constructor injection
- [ ] Normalize `GeneratorPlugin.generate()` return shape — deprecate legacy `Record<string, string>`, require `{ files, evidence }`

### Test Coverage Gaps

- [ ] `wesley-generator-js` — 4 source files, 0 tests
- [ ] `wesley-host-bun` — 1 source file, 0 tests
- [ ] `wesley-scaffold-multitenant` — 1 source file, 0 tests
- [ ] `wesley-slaps` — 3 source files, 0 tests
- [ ] `wesley-host-browser` — only 2 tests, needs worker lifecycle + async loading + error scenarios

### Dead Dependency

- [ ] `@wesley/generator-echo` declares `@wesley/host-node` in `package.json` but no imports found — verify and remove

---

---

# IR Schema Reconciliation — Promote `WesleyIR.schema.ts` to Runtime Truth

Tracked in branch `revive-dead-code` (PR #400 follow-up).

**Goal:** Make the parser emit IR matching the TypeScript schema, update JSON
schema to match, migrate all consumers. The shim strategy keeps tests green at
each step.

---

## Phase 0 — Failing Tests

- [x] **T-0.1** Create `packages/wesley-host-node/test/parser-ir-v2.test.mjs`
  Assert new IR shape: `table.fields` (not `columns`), `field.type.base === 'ID'`,
  `field.type.isList`, `field.directives.pk`, `table.directives.table`,
  `ir.version === '1.0.0'`, `ir.metadata.generatedAt`, `ir.relationships` array.

- [x] **T-0.2** Create `packages/wesley-host-browser/src/BrowserParserPort.test.mjs`
  22 tests asserting canonical WesleyIR shape from the browser parser.

## Phase 1 — Update Primary Producer + Backward-Compat Shim

- [x] **T-1.1** Rewrite `GraphQLAdapter.buildIRFromAST()` to emit new shape
  `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`
  - Return `{ version: "1.0.0", metadata: { sourceHash, generatedAt }, tables, enums: [], scalars: [], relationships }`
  - `buildTable()` → `{ name, directives: TableDirectives, fields: Field[], indexes: Index[], constraints: Constraint[] }`
  - `buildColumn()` → `buildField()` returning `{ name, type: { base, isList, listItemNullable }, nullable, directives: FieldDirectives }`
  - Stop calling `mapGraphQLTypeToPostgreSQL()` — keep GraphQL scalar as `type.base`
  - Synthesize `relationships[]` from `@fk` directives in a second pass

- [x] **T-1.2** Add backward-compat shim after `buildIRFromAST()`
  Compute `table.columns = table.fields`, `table.primaryKey`, `table.foreignKeys`,
  `table.tenantBy` from the new shape so existing consumers survive the transition.

- [x] **T-1.3** Update `parseComposed()` for new shape
  Use `table.fields` not `table.columns`, structured directives, etc.

- [x] **T-1.4** Update `validateForeignKeys()` for new shape
  Use `table.fields` and `field.directives.fk`.

## Phase 2 — Update JSON Schema

- [x] **T-2.1** Rewrite `schemas/ir.schema.json` to match `WesleyIR.schema.ts`
  Add `version`, `metadata`, change `columns` → `fields`, type string → `FieldType`
  object, add `enums`, `scalars`, `relationships`.

- [x] **T-2.2** Update `schemas/ir-envelope.schema.json` if needed
  Verified — $ref to ir.schema.json still resolves correctly.
  Verify `$ref` still resolves correctly.

## Phase 3 — Migrate `irToSchema.mjs`

- [x] **T-3.1** Rewrite `packages/wesley-cli/src/framework/irToSchema.mjs`
  - `t.columns` → `t.fields`
  - `pgTypeToGraphQL(c.type)` → `c.type.base` (already GraphQL scalar)
  - `c.type.includes('[]')` → `c.type.isList`
  - `buildFieldDirectives()` simplifies: `field.directives.pk`, `.fk`, `.unique`, `.default`, `.index` are already structured
  - Remove `PG_TO_GQL` map entirely

## Phase 4 — Migrate `host-node/index.mjs`

- [x] **T-4.1** Update `GraphQLSchemaParser.convertIRToSchema()`
  `packages/wesley-host-node/src/index.mjs`
  - `tableData.columns` → `tableData.fields`
  - `postgresqlToGraphQLType()` no longer needed — `field.type.base` is already GraphQL
  - Read directives from structured `field.directives` directly

## Phase 5 — Migrate Supabase Generator

- [x] **T-5.1** Update `emitDDL()` and `emitRLS()` in `packages/wesley-generator-supabase/src/emit.mjs`
  - `table.columns` → `table.fields`
  - `col.type` (PG string) → map `field.type.base` from GraphQL to PG (move mapping here or shared util)
  - `col.nullable`, `.default`, `.unique` → read from `field.directives`
  - `table.primaryKey` → find field where `field.directives.pk === true`
  - `table.foreignKeys` → collect fields with `field.directives.fk`
  - `t.tenantBy` → `t.directives.tenant?.field`
  - `t.directives['wes_rls']` → `t.directives.rls`

## Phase 6 — Migrate JS Model Generator

- [x] **T-6.1** Update `ModelGenerator.generate()` in `packages/wesley-generator-js/src/model.mjs`
  - `table.columns` → `table.fields`
  - `column.type` (PG string) → map from `field.type.base` (GraphQL scalar)
  - `column.default` → `field.directives.default?.value`

## Phase 7 — Migrate Migration Plan Helpers

- [x] **T-7.1** Update `packages/wesley-cli/src/commands/_migration-plan.mjs`
  - `t.columns` → `t.fields`
  - `c.type` → map `field.type.base` to PG type for SQL emission
  - `t.foreignKeys` → collect from `field.directives.fk`

- [x] **T-7.2** Update `packages/wesley-cli/src/commands/up.mjs`
  Has its own copy of `buildAdditivePlan` — same changes as T-7.1.
  Also update snapshot writes.

- [x] **T-7.3** Update `packages/wesley-cli/src/commands/generate.mjs`
  `ir.tables`, `t.primaryKey` (for PK map), snapshot writes.

## Phase 8 — Migrate Browser Host

- [x] **T-8.1** Update `packages/wesley-host-browser/src/BrowserParserPort.mjs`
  Emit `fields` with structured `FieldType` instead of `columns` with PG strings.

- [x] **T-8.2** Update `packages/wesley-host-browser/src/index.mjs`
  `compileSchemaInBrowser()` reads `table.fields`, maps types.

## Phase 9 — Migrate Bun and Deno Hosts

- [x] **T-9.1** Update `packages/wesley-host-bun/src/index.mjs`
  Emit `fields: []` (or structured) instead of minimal `{ tables: [{ name }] }`.

- [x] **T-9.2** Update `packages/wesley-host-deno/mod.ts`
  Same as T-9.1.

## Phase 10 — Update Fixtures and Tests

- [x] **T-10.1** `test/fixtures/examples/.wesley/snapshot.json` — gitignored, generated at
  runtime by CLI commands. Already emits new shape (`{ irVersion, tables }` with
  `table.fields`). No manual rewrite needed.

- [x] **T-10.2** Update `packages/wesley-host-node/test/parser-ir.test.mjs`
  Update assertions: `table.fields`, `field.type.base`, etc.

- [x] **T-10.3** Update `test/browser/contracts/main.js`
  `u.columns` → `u.fields`

- [x] **T-10.4** Reviewed `packages/wesley-host-browser/src/index.test.mjs`
  Tests assert SQL output strings and table counts only — no IR shape dependency.
  No changes needed.

- [x] **T-10.5** Review `packages/wesley-core/test/wave3-safety-integration.test.mjs`
  Uses `columns` in its own test model for ConcurrentSafetyAnalyzer — NOT Wesley IR. No change needed.

## Phase 11 — Extract Shared Type Mapping Utility

- [x] **T-11.1** Create shared GQL↔PG type mapping in `@wesley/core`
  `{ ID: 'uuid', String: 'text', Int: 'integer', Float: 'double precision', ... }`
  Replaces duplicated mappings in: `GraphQLAdapter.mapGraphQLTypeToPostgreSQL`,
  `irToSchema.PG_TO_GQL`, `host-node/index.postgresqlToGraphQLType`,
  `BrowserParserPort`, `emit.mjs`, `model.mjs`.

## Phase 12 — Remove Backward-Compat Shim

- [x] **T-12.1** Remove shim from `GraphQLAdapter` and `BrowserParserPort` (added in T-1.2)
  All consumers now use the new shape directly. Removed `applyBackwardCompatShim`,
  `mapGraphQLTypeToPostgreSQL_fromFieldType`, `gqlScalarToPostgreSQL`, `flattenFieldDirectives`.
  Also removed shim `foreignKeys` loop from `parseComposed()` and `GQL_TO_PG` from BrowserParserPort.

## Phase 13 — Clean Up Old Tests

- [x] **T-13.1** Updated `parser-ir.test.mjs` to assert new IR shape (fields, FieldType, directives)
- [x] **T-13.2** Updated `parser-ir-v2.test.mjs`: replaced backward-compat shim tests with
  a negative assertion confirming legacy properties are absent

---

## Consumer Inventory

Files that read raw IR (must be migrated):

| File | Properties accessed | Phase |
|---|---|---|
| `packages/wesley-cli/src/framework/irToSchema.mjs` | `t.columns`, `c.type` (PG), `table.primaryKey`, `table.foreignKeys`, `table.indexes` | 3 |
| `packages/wesley-host-node/src/index.mjs` | `tableData.columns`, `columnData.type` (PG), `tableData.primaryKey`, `tableData.foreignKeys`, `tableData.indexes`, `tableData.tenantBy` | 4 |
| `packages/wesley-generator-supabase/src/emit.mjs` | `table.columns`, `col.type` (PG), `table.primaryKey`, `table.foreignKeys`, `table.indexes`, `t.tenantBy` | 5 |
| `packages/wesley-generator-js/src/model.mjs` | `table.columns`, `column.type` (PG), `column.default` | 6 |
| `packages/wesley-cli/src/commands/_migration-plan.mjs` | `t.columns`, `t.indexes`, `t.foreignKeys`, `c.type` | 7 |
| `packages/wesley-cli/src/commands/up.mjs` | `t.columns`, `t.indexes`, `t.foreignKeys`, `c.type` | 7 |
| `packages/wesley-cli/src/commands/generate.mjs` | `ir.tables`, `t.primaryKey` | 7 |
| `packages/wesley-host-browser/src/BrowserParserPort.mjs` | Producer — emits `columns` with PG strings | 8 |
| `packages/wesley-host-browser/src/index.mjs` | `table.columns`, `col.type` (PG) | 8 |
| `packages/wesley-host-bun/src/index.mjs` | Producer — emits minimal `{ tables: [{ name }] }` | 9 |
| `packages/wesley-host-deno/mod.ts` | Producer — emits minimal `{ tables: [{ name }] }` | 9 |

Files that use domain `Schema` objects (NOT affected):
`PostgreSQLGenerator`, `TriggerGenerator`, `MigrationDiffer`, `RollbackGenerator`, `CICOrchestrator`
