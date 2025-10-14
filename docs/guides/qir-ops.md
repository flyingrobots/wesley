# Query Operations (QIR) — Lowering and Emission (MVP)

Status: Experimental (behind `--ops`). Public CLI behavior is unchanged.

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
  - SQL Function (Invoker): `CREATE OR REPLACE FUNCTION wes_ops.op_<name>(params...) RETURNS SETOF jsonb LANGUAGE sql STABLE AS $$ SELECT to_jsonb(q.*) FROM (<select>) q $$;`
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
const sql = emitFunction('Org List', plan);
// CREATE OR REPLACE FUNCTION wes_ops.op_org_list(p_ids text[])
// RETURNS SETOF jsonb
// LANGUAGE sql
// STABLE
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

## Using --ops (Experimental)

The CLI can compile operation descriptions into SQL when `--ops` points to a directory of `*.op.json` files. The MVP DSL supports a root table, projected columns, basic filters, ordering, and limit/offset.

### Directory layout

```text
your-repo/
├── schema.graphql
└── ops/
    ├── products_by_name.op.json
    └── orders_by_user.op.json
```

> [!NOTE]
> The current release scans only the top-level of the directory you pass to `--ops`. Nested folders and glob patterns are planned but not yet implemented.

Each file must contain a JSON document describing the operation. For example, `example/ops/products_by_name.op.json`:

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

### CLI flags

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema example/ecommerce.graphql \
  --ops example/ops \
  --emit-bundle \
  --out-dir example/out \
  --allow-dirty
```

| Flag | Description |
| --- | --- |
| `--ops <dir>` | Enable operation compilation for all `*.op.json` files in the directory (non-recursive). |
| `--ops-schema <name>` | Override the target schema for emitted SQL (default `wes_ops`). |
| `--ops-allow-errors` | Continue compiling even if individual operations fail validation. Disabled on CI unless `--i-know-what-im-doing` is also supplied. |

Compiled artifacts are written under `out/ops/`:
- `ops/<name>.fn.sql` — always generated; contains `CREATE FUNCTION wes_ops.op_<name>(...)`.
- `ops/<name>.view.sql` — emitted only when the operation has no parameters; exposes a read-only `CREATE VIEW`.

Example output:

```text
example/out/
└── ops/
    ├── products_by_name.fn.sql
    ├── products_by_name.view.sql
    ├── orders_by_user.fn.sql
    └── orders_by_user.view.sql   # only if paramless
```

### Identifier sanitisation and limits

- Operation names are normalised (NFKD), lowercased, and converted to snake case. Non-alphanumeric characters collapse to `_`.
- Identifiers cannot exceed PostgreSQL’s 63-byte limit. If the base name or prefixed identifier (`op_<name>`) becomes too long, the CLI raises `OPS_IDENTIFIER_TOO_LONG`.
- Duplicate (post-sanitisation) names cause an `OPS_COLLISION` error. Resolve by renaming or restructuring the files.

### Error handling

- Invalid JSON or DSL violations raise `OPS_PARSE_FAILED`.
- Discovery skips silently if the directory is missing or contains no `*.op.json` files.
- `--ops-allow-errors` (outside CI, or with `--i-know-what-im-doing`) allows compilation to continue while logging each failure.

### Applying and inspecting operations

1. Run `wesley generate --ops …` to produce SQL.
2. Apply the generated function and (optionally) view files using your preferred migration runner or `psql`:

   ```bash
   psql "$DATABASE_URL" -f out/ops/products_by_name.fn.sql
   psql "$DATABASE_URL" -f out/ops/products_by_name.view.sql
   ```

3. Use `EXPLAIN (FORMAT JSON)` or snapshot tooling (see the HOLMES workflow) to inspect execution plans and ensure proper indexes exist.

### Discovery roadmap

Future releases will add:
- Recursive discovery and glob support (`--ops-glob`).
- Manifest-driven inclusion/exclusion (`--ops-manifest`).
- Automatic EXPLAIN JSON snapshots and pgTAP smoke tests.

See `docs/drafts/2025-10-08-ops-discovery-modes.md` for details.

## Roadmap

- Wire `--ops` end-to-end in CLI (expose emission; EXPLAIN JSON snapshots).
- Use actual PK/unique keys for deterministic ORDER BY.
- Option to `RETURNS TABLE(...)` with projected column shapes.
- RLS defaults phase 2 and pgTAP for policies generated from annotations.

See also: docs/drafts/2025-10-03-rfc-query-ops-to-sql-qir.md
