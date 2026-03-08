# IR Schema Reconciliation — Promote `WesleyIR.schema.ts` to Runtime Truth

Tracked in branch `revive-dead-code` (PR #400 follow-up).

**Goal:** Make the parser emit IR matching the TypeScript schema, update JSON
schema to match, migrate all consumers. The shim strategy keeps tests green at
each step.

---

## Phase 0 — Failing Tests

- [ ] **T-0.1** Create `packages/wesley-host-node/test/parser-ir-v2.test.mjs`
  Assert new IR shape: `table.fields` (not `columns`), `field.type.base === 'ID'`,
  `field.type.isList`, `field.directives.pk`, `table.directives.table`,
  `ir.version === '1.0.0'`, `ir.metadata.generatedAt`, `ir.relationships` array.

- [ ] **T-0.2** Create `packages/wesley-host-browser/test/parser-ir-v2.test.mjs`
  Same shape assertions for browser parser.

## Phase 1 — Update Primary Producer + Backward-Compat Shim

- [ ] **T-1.1** Rewrite `GraphQLAdapter.buildIRFromAST()` to emit new shape
  `packages/wesley-host-node/src/adapters/GraphQLAdapter.mjs`
  - Return `{ version: "1.0.0", metadata: { sourceHash, generatedAt }, tables, enums: [], scalars: [], relationships }`
  - `buildTable()` → `{ name, directives: TableDirectives, fields: Field[], indexes: Index[], constraints: Constraint[] }`
  - `buildColumn()` → `buildField()` returning `{ name, type: { base, isList, listItemNullable }, nullable, directives: FieldDirectives }`
  - Stop calling `mapGraphQLTypeToPostgreSQL()` — keep GraphQL scalar as `type.base`
  - Synthesize `relationships[]` from `@fk` directives in a second pass

- [ ] **T-1.2** Add backward-compat shim after `buildIRFromAST()`
  Compute `table.columns = table.fields`, `table.primaryKey`, `table.foreignKeys`,
  `table.tenantBy` from the new shape so existing consumers survive the transition.

- [ ] **T-1.3** Update `parseComposed()` for new shape
  Use `table.fields` not `table.columns`, structured directives, etc.

- [ ] **T-1.4** Update `validateForeignKeys()` for new shape
  Use `table.fields` and `field.directives.fk`.

## Phase 2 — Update JSON Schema

- [ ] **T-2.1** Rewrite `schemas/ir.schema.json` to match `WesleyIR.schema.ts`
  Add `version`, `metadata`, change `columns` → `fields`, type string → `FieldType`
  object, add `enums`, `scalars`, `relationships`.

- [ ] **T-2.2** Update `schemas/ir-envelope.schema.json` if needed
  Verify `$ref` still resolves correctly.

## Phase 3 — Migrate `irToSchema.mjs`

- [ ] **T-3.1** Rewrite `packages/wesley-cli/src/framework/irToSchema.mjs`
  - `t.columns` → `t.fields`
  - `pgTypeToGraphQL(c.type)` → `c.type.base` (already GraphQL scalar)
  - `c.type.includes('[]')` → `c.type.isList`
  - `buildFieldDirectives()` simplifies: `field.directives.pk`, `.fk`, `.unique`, `.default`, `.index` are already structured
  - Remove `PG_TO_GQL` map entirely

## Phase 4 — Migrate `host-node/index.mjs`

- [ ] **T-4.1** Update `GraphQLSchemaParser.convertIRToSchema()`
  `packages/wesley-host-node/src/index.mjs`
  - `tableData.columns` → `tableData.fields`
  - `postgresqlToGraphQLType()` no longer needed — `field.type.base` is already GraphQL
  - Read directives from structured `field.directives` directly

## Phase 5 — Migrate Supabase Generator

- [ ] **T-5.1** Update `emitDDL()` and `emitRLS()` in `packages/wesley-generator-supabase/src/emit.mjs`
  - `table.columns` → `table.fields`
  - `col.type` (PG string) → map `field.type.base` from GraphQL to PG (move mapping here or shared util)
  - `col.nullable`, `.default`, `.unique` → read from `field.directives`
  - `table.primaryKey` → find field where `field.directives.pk === true`
  - `table.foreignKeys` → collect fields with `field.directives.fk`
  - `t.tenantBy` → `t.directives.tenant?.field`
  - `t.directives['wes_rls']` → `t.directives.rls`

## Phase 6 — Migrate JS Model Generator

- [ ] **T-6.1** Update `ModelGenerator.generate()` in `packages/wesley-generator-js/src/model.mjs`
  - `table.columns` → `table.fields`
  - `column.type` (PG string) → map from `field.type.base` (GraphQL scalar)
  - `column.default` → `field.directives.default?.value`

## Phase 7 — Migrate Migration Plan Helpers

- [ ] **T-7.1** Update `packages/wesley-cli/src/commands/_migration-plan.mjs`
  - `t.columns` → `t.fields`
  - `c.type` → map `field.type.base` to PG type for SQL emission
  - `t.foreignKeys` → collect from `field.directives.fk`

- [ ] **T-7.2** Update `packages/wesley-cli/src/commands/up.mjs`
  Has its own copy of `buildAdditivePlan` — same changes as T-7.1.
  Also update snapshot writes.

- [ ] **T-7.3** Update `packages/wesley-cli/src/commands/generate.mjs`
  `ir.tables`, `t.primaryKey` (for PK map), snapshot writes.

## Phase 8 — Migrate Browser Host

- [ ] **T-8.1** Update `packages/wesley-host-browser/src/BrowserParserPort.mjs`
  Emit `fields` with structured `FieldType` instead of `columns` with PG strings.

- [ ] **T-8.2** Update `packages/wesley-host-browser/src/index.mjs`
  `compileSchemaInBrowser()` reads `table.fields`, maps types.

## Phase 9 — Migrate Bun and Deno Hosts

- [ ] **T-9.1** Update `packages/wesley-host-bun/src/index.mjs`
  Emit `fields: []` (or structured) instead of minimal `{ tables: [{ name }] }`.

- [ ] **T-9.2** Update `packages/wesley-host-deno/mod.ts`
  Same as T-9.1.

## Phase 10 — Update Fixtures and Tests

- [ ] **T-10.1** Rewrite `test/fixtures/examples/.wesley/snapshot.json` to new shape

- [ ] **T-10.2** Update `packages/wesley-host-node/test/parser-ir.test.mjs`
  Update assertions: `table.fields`, `field.type.base`, etc.

- [ ] **T-10.3** Update `test/browser/contracts/main.js`
  `u.columns` → `u.fields`

- [ ] **T-10.4** Update `packages/wesley-host-browser/src/index.test.mjs`
  Review SQL output assertions for any indirect IR shape dependency.

- [ ] **T-10.5** Review `packages/wesley-core/test/wave3-safety-integration.test.mjs`
  Uses `columns` in test model — verify if it touches IR or domain objects.

## Phase 11 — Extract Shared Type Mapping Utility

- [ ] **T-11.1** Create shared GQL↔PG type mapping in `@wesley/core`
  `{ ID: 'uuid', String: 'text', Int: 'integer', Float: 'double precision', ... }`
  Replaces duplicated mappings in: `GraphQLAdapter.mapGraphQLTypeToPostgreSQL`,
  `irToSchema.PG_TO_GQL`, `host-node/index.postgresqlToGraphQLType`,
  `BrowserParserPort`, `emit.mjs`, `model.mjs`.

## Phase 12 — Remove Backward-Compat Shim

- [ ] **T-12.1** Remove shim from `GraphQLAdapter` (added in T-1.2)
  All consumers now use the new shape directly.

## Phase 13 — Clean Up Old Tests

- [ ] **T-13.1** Merge or delete `parser-ir.test.mjs` if `parser-ir-v2.test.mjs` covers it
- [ ] **T-13.2** Delete `parser-ir-v2.test.mjs` rename — just use `parser-ir.test.mjs`

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
