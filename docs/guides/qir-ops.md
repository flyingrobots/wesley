# Query Operations (QIR) — Lowering and Emission (MVP)

Status: Enabled. Ops discovery runs automatically when an ops manifest or an `ops/` directory is present.

This guide documents the MVP of the Query IR (QIR) pipeline that compiles operation plans into deterministic SQL and wraps them for execution.

## What’s implemented (MVP)

- QIR domain types (`packages/wesley-core/src/domain/qir/Nodes.mjs`): QueryPlan, Table/Join/Lateral/Subquery nodes, Projection/Exprs, Predicates, OrderBy.
- Lowering to SQL (`lowerToSQL.mjs`):
  - SELECT with JOIN/LEFT JOIN/LATERAL, ORDER BY, LIMIT/OFFSET.
  - Predicate semantics: `isNull/isNotNull`, `eq null` → `IS NULL`, `in []` → false sentinel, arrays → `= ANY($n::<type[]>)`.
  - Nested lists: `COALESCE(jsonb_agg(...), '[]'::jsonb)`.
  - Deterministic ORDER BY: appends tie-breaker on `<alias>.id` if not specified.
  - Deterministic param ordering using `collectParams()`.
- Emission (`emit.mjs`):
  - View: `CREATE OR REPLACE VIEW wes_ops.op_<name> AS <select>`.
  - SQL Function: `CREATE OR REPLACE FUNCTION wes_ops.op_<name>(params...) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY {INVOKER|DEFINER} [SET search_path = ...] AS $$ SELECT to_jsonb(q.*) FROM (<select>) q $$;`
  - Deterministic naming (`op_<sanitized-name>`), params from `collectParams()` (`p_<name> <type>`), schema `wes_ops`.

## Constraints and behavior

- The lowering phase (lowerToSQL.mjs) avoids quoting identifiers for readability in tests, but will minimally quote reserved identifiers to avoid invalid SQL (e.g., table "order"). Do not rely on this for security.
- Security warning: Because lowering primarily emits unquoted identifiers, user-controlled values MUST NEVER flow into table/column/alias names. Only use trusted, validated identifiers from schema metadata or a server-side whitelist. As an immediate mitigation, validate/whitelist identifiers server-side and avoid interpolating raw user values; future releases will add stricter validation/quoting modes.

- Function returns `SETOF jsonb` for MVP to keep signatures stable; future work can emit `RETURNS TABLE (...)` if desired.
- Primary key tie-breaker currently assumes `<leftmost-alias>.id`; will use real PK/unique keys when metadata is available.

## Examples

Lower a simple plan:

```js
import { QueryPlan, TableNode, Projection, ProjectionItem, ColumnRef, OrderBy } from '@wesley/core/domain/qir';
import { lowerToSQL } from '@wesley/core/domain/qir';

const root = new TableNode('organization', 't0');
const proj = new Projection([
  new ProjectionItem('id', new ColumnRef('t0','id')),
  new ProjectionItem('name', new ColumnRef('t0','name')),
]);
const plan = new QueryPlan(root, proj, { orderBy: [ new OrderBy(new ColumnRef('t0','name'), 'asc') ] });

console.log(lowerToSQL(plan));
// SELECT t0.id AS id, t0.name AS name
// FROM organization t0
// ORDER BY t0.name ASC, t0.id ASC
```

Emit a function with an IN parameter:

```js
import { emitFunction } from '@wesley/core/domain/qir';

// Assume plan has WHERE t0.id IN $ids::text[]
const sql = emitFunction('Org List', plan, { security: 'invoker', setSearchPath: ['pg_catalog','wes_ops'] });
// CREATE OR REPLACE FUNCTION wes_ops.op_org_list(p_ids text[])
// RETURNS SETOF jsonb
// LANGUAGE sql
// STABLE
// SECURITY INVOKER
// SET search_path = "pg_catalog", "wes_ops"
// AS $$
// SELECT to_jsonb(q.*) FROM (
//   SELECT ...
// ) AS q
// $$;
```

Emit a view:

```js
import { emitView } from '@wesley/core/domain/qir';

const viewSql = emitView('Org View!', plan);
console.log(viewSql);
// CREATE OR REPLACE VIEW wes_ops.op_org_view AS
// SELECT ...
```

## Tests

- Unit tests: `packages/wesley-core/test/unit/qir-*.test.mjs` (nodes, param collector, predicate compiler, lowering semantics).
- Snapshot-style: `packages/wesley-core/test/snapshots/qir-emission.test.mjs` (function/view wrappers, COALESCE jsonb_agg, IN ANY, tie-breakers).

Run:

```bash
pnpm -C packages/wesley-core test:unit
pnpm -C packages/wesley-core test:snapshots
```

## Using Ops (Always-On Discovery)

You don’t need a flag to compile ops during generate. If the project contains either an ops manifest (preferred) or a conventional `ops/` directory, Wesley compiles all `*.op.json` plans.
The DSL supports a root table, projected columns, basic filters, ordering, and limit/offset.

Example file: `test/fixtures/examples/ops/products_by_name.op.json`

```json
{
  "name": "products_by_name",
  "table": "product",
  "columns": ["id", "name", "slug"],
  "filters": [
    { "column": "published", "op": "eq", "value": true },
    { "column": "name", "op": "ilike", "param": { "name": "q", "type": "text" } }
  ],
  "orderBy": [ { "column": "name", "dir": "asc" } ],
  "limit": 50
}
```

Generate and emit ops SQL to `out/ops/`:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --ops-security invoker \
  --ops-search-path "pg_catalog, wes_ops" \
  --emit-bundle \
  --out-dir out/examples \
  --allow-dirty
```

This produces both a `CREATE VIEW` and a `CREATE FUNCTION` for each operation, e.g.: `out/examples/ops/products_by_name.view.sql` and `out/examples/ops/products_by_name.fn.sql`.

In addition, Wesley emits a machine-readable operation registry:

- `out/examples/ops/registry.json` — versioned (version: "1.0.0") index listing each op’s sanitized name, target schema, function/view identifiers, parameter order and types, projected field aliases (when specified), and the source op file path. Adapters can use this to wire RPC endpoints without parsing SQL.

Example (abridged):

```json
{
  "schema": "wes_ops",
  "ops": [
    {
      "name": "products_by_name",
      "sql": { "schema": "wes_ops", "function": "op_products_by_name", "view": "op_products_by_name" },
      "params": [ { "name": "q", "type": "text" } ],
      "projection": { "star": false, "items": ["id","name","slug"] },
      "files": { "function": "products_by_name.fn.sql", "view": "products_by_name.view.sql" },
      "sourceFile": "ops/queries/products_by_name.op.json"
    }
  ]
}
```

### Discovery and Manifest

By default, discovery is strict and deterministic:
- If an ops manifest is present, Wesley validates it (schemas/ops-manifest.schema.json) and compiles the listed files (and directories) in sorted order. Use `include` for files/dirs and `exclude` for pruning.
- If no manifest is present but an `ops/` directory exists, Wesley recursively discovers all `**/*.op.json` files, sorts them deterministically, and compiles them.
- If neither is present, ops are skipped with a helpful log line.

Example `ops/ops.manifest.json`:

```json
{
  "include": [
    "ops/queries",
    "ops/special/report_x.op.json"
  ],
  "exclude": [
    "ops/queries/experimental/"
  ]
}
```

### Validating QIR plans (schema-backed)

QIR is self-documented via a JSON Schema and can be validated using the CLI:

- Validate a single QIR plan JSON:
  - `wesley qir validate test/fixtures/qir/sample-flat.qir.json`

- Validate an IR envelope (Schema IR + QIR plans):
  - `wesley qir envelope-validate test/fixtures/qir/sample-envelope.json`

## Emission rules (recap)

- Strict identifier policy in ops emission: deterministic quoting with validation.
- ORDER BY tie‑breakers use real primary keys from Schema IR (via pkResolver).
- IN/LIKE/ILIKE/CONTAINS require explicit param types in the op plan builder.
- For each op, the CLI emits:
  - `<name>.fn.sql` — function wrapper (SETOF jsonb)
  - `<name>.view.sql` — view wrapper when the op is paramless
  - `registry.json` — machine‑readable index of compiled ops
- A transactional `ops_deploy.sql` bundles the statements (BEGIN; CREATE SCHEMA IF NOT EXISTS; all views/functions; COMMIT).

### Optional: EXPLAIN JSON snapshots

Pass `--ops-explain mock` to emit a lightweight EXPLAIN‑shaped JSON file alongside ops:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --ops test/fixtures/examples/ops \
  --ops-explain mock \
  --ops-allow-errors \
  --allow-dirty
```

This produces `out/.../ops/explain/<name>.explain.json` with a stub shape:

```json
{ "Plan": { "Node Type": "Result", "Plans": [] }, "Mock": true, "Version": 1 }
```
It’s intentionally DB‑free; swap to a real EXPLAIN strategy in a future phase.

These validators load schemas from the local `schemas/` folder and fail with structured errors when the shape drifts.

### Discovery Modes (planned)

We are moving to a strict discovery model by default: when `--ops <dir>` is present, Wesley will recursively compile all `**/*.op.json` files (configurable with `--ops-glob`), fail if none are found unless `--ops-allow-empty` is provided, and sort files deterministically. A manifest mode (`--ops-manifest`) will be available for curated control (include/exclude lists). See the design note in `docs/drafts/2025-10-08-ops-discovery-modes.md`.

## Roadmap

- Wire `--ops` end-to-end in CLI (expose emission; EXPLAIN JSON snapshots).
- Use actual PK/unique keys for deterministic ORDER BY.
- Option to `RETURNS TABLE(...)` with projected column shapes.
- RLS defaults phase 2 and pgTAP for policies generated from annotations.

See also: docs/drafts/2025-10-03-rfc-query-ops-to-sql-qir.md

## Security defaults and search_path

By default, emitted functions use `SECURITY INVOKER` and do not modify `search_path`. For hardened deployments you can:

- Switch to definer: `--ops-security definer` when the op must bypass caller RLS and you’ve audited the body.
- Pin lookup path: `--ops-search-path "pg_catalog, <your_app_schema>"` to avoid unexpected name resolution via the session’s `search_path`.

You can also call `emitFunction(name, plan, { security, setSearchPath })` directly when embedding in custom tooling.

## Identifier policy for reserved words (strict mode)

Strict mode validates identifiers and errors on reserved keywords (e.g., table named `order`). This avoids ambiguous SQL and unexpected behavior from partial quoting. If you must work with legacy schemas containing reserved names, either rename at source or compile with `--ops-allow-errors` to skip failing ops while you migrate. A future policy option may allow strict‑but‑quoted rendering; for now, failure is explicit by design.
