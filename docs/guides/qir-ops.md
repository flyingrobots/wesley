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

- Lowering avoids identifier quoting for readability in tests; reserved identifiers should be avoided in aliases and column names.
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

emitView('Org View!', plan);
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

 
 
## Roadmap

- Wire `--ops` end-to-end in CLI (expose emission; EXPLAIN JSON snapshots).
- Use actual PK/unique keys for deterministic ORDER BY.
- Option to `RETURNS TABLE(...)` with projected column shapes.
- RLS defaults phase 2 and pgTAP for policies generated from annotations.

See also: docs/drafts/2025-10-03-rfc-query-ops-to-sql-qir.md
