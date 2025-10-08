# GraphQL Operation → QIR Translator (MVP Plan)

Status: Design/Implementation Plan — MVP scope

## Goal

Translate a minimal subset of GraphQL operation documents (queries) into the existing QIR JSON DSL used by `OpPlanBuilder`, then compile to SQL via lowering+emission.

## MVP Scope

- Inputs: GraphQL `query` documents with a single root field selecting from a type annotated with `@wes_table`.
- Features:
  - Root table selection from a field that maps to a table type.
  - Selection set → projected columns (scalars only in MVP).
  - Arguments → filters and params:
    - Equality (=) for scalar args (e.g., `user_id: $uuid`).
    - `ilike` for string “contains” helpers (e.g., `name_contains: $q`).
    - `in` for array args (`ids: $ids`).
  - Ordering + pagination: `orderBy: {column, dir}`; `limit`, `offset` if present.
  - Nested list fields mapped to LATERAL + `jsonb_agg` using `match: { local, foreign }` conventions.
- Out of scope (defer): fragments, aliases, complex directives, computed fields, joins beyond simple FK mapping.

## Mapping Rules (GraphQL → QIR JSON)

- Root
  - `query opName { Products(…args…) { …fields… } }` → `{ name: opName, table: "product", columns: […], filters: […], orderBy, limit, offset }`
  - Derive table name from `@wes_table` type name (lowercased).
- Selection set → `columns`
  - Scalars only; ignore unknown fields; error on nested object unless mapped under `lists`.
- Args → `filters`
  - `arg: $var` where var has type hint → `{ column: arg, op: 'eq', param: { name: varName, type: hintedType } }`.
  - `name_contains: $q` → `{ column: 'name', op: 'ilike', param: { name: 'q', type: 'text' } }`.
  - `ids: $ids` (list) → `{ column: 'id', op: 'in', param: { name: 'ids', type: 'uuid[]' } }`.
- Ordering/pagination
  - Support `orderBy: { column, dir }`, `limit`, `offset`.
- Lists (nested)
  - For known list fields with FK mapping (e.g., `order_items`), inject `lists` entry with `match: { local: 'id', foreign: 'order_id' }` and `select` scalar columns.

## Data Sources

- Use GraphQL schema (SDL + Wesley directives) to resolve type→table and field→column mappings; rely on `@wes_fk` metadata for `lists`.

## Public API

- Core export: `buildPlanFromGql(queryDoc, schemaSDL, options?) → QueryPlan`
  - Uses `@wesley/host-node` GraphQL adapter to parse SDL and op doc.
  - Produces the same QueryPlan produced by `buildPlanFromJson`.
- CLI integration (behind `--ops-gql <dir>` in a later PR): compile `.graphql` ops to SQL alongside `.op.json`.

## Implementation Steps

1) Parser & Mapper (core)
   - Add `packages/wesley-core/src/domain/qir/OpFromGql.mjs` mapping GraphQL AST → JSON DSL.
   - Handle MVP: root field, scalar selections, args→filters, order/limit/offset; lists via known FK mapping.
   - Unit tests for mapping rules.

2) Integration (CLI)
   - Optional flag `--ops-gql <dir>`: discover `**/*.graphql` documents; parse and map to plans; compile to SQL.
   - Keep separate from JSON ops to avoid ambiguity; future: single `--ops` supporting both with different extensions.

3) Docs & Examples
   - Add examples under `example/ops-gql/` with README mapping.
   - Update QIR ops guide with a “GraphQL Ops (MVP)” section.

4) CI
   - Add a minimal bats test that compiles a `.graphql` op and verifies artifacts presence.

## Risks / Constraints

- Ambiguity in user GraphQL ops (naming, filters) — keep MVP explicit (narrow helper set like `name_contains`).
- SDL resolution — rely on existing adapter; limit to table-backed types for MVP.

## Backout

- Feature flag via CLI `--ops-gql`; revertable without touching JSON ops.

