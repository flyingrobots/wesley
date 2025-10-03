# RFC: Compile GraphQL Operations to SQL via a Query IR (QIR)

- Status: Draft (updated per maintainer feedback)
- Date: 2025-10-03
- Owner: Core Team
- Discussed In: docs/architecture/overview.md, docs/architecture/paradigm-shift.md
- Related: packages/wesley-core/src/domain/{GraphQLSchemaBuilder.mjs,OperationRegistry.mjs,SQLAst.mjs}, packages/wesley-core/src/domain/generators/RPCFunctionGeneratorV2.mjs, packages/wesley-generator-supabase/src/rpc.mjs

## Summary

Wesley inverts the traditional “DB → GraphQL” flow: a single GraphQL schema becomes DDL, migrations, types, tests, and evidence. Today, custom read/write operations are often expressed by embedding SQL/PLpgSQL strings in directives like `@rpc(sql: ...)` or `@function(logic: ...)`. That is expedient, but it isn’t idiomatic GraphQL and undermines the “one declarative language” story.

This RFC proposes a first-class pipeline to compile actual GraphQL operation documents (queries/mutations) into safe, parameterized SQL (views or functions) using a minimal Query IR (QIR). The goal is to express intent purely in GraphQL and let Wesley generate the correct relational plan and artifacts, while respecting RLS, tenant/owner directives, and zero-downtime philosophy.

Updates in this revision incorporate maintainer feedback: spec-compliant auth variables, null vs empty-list semantics, SECURITY DEFINER hardening, deterministic output, and zero-downtime versioning for ops artifacts.

## Goals

- Define reads as standard GraphQL operations (documents), not inline SQL.
- Compile to parameterized SQL (or views/functions) that preserve GraphQL result shape and performance expectations.
- Integrate with existing mappings (types→tables, fields→columns, relationships via directives).
- Respect security/tenancy (`@wes_rls`, `@wes_owner`, `@wes_tenant`) and avoid duplicating RLS logic when enabled.
- Emit evidence (citations into `.wesley/evidence-map.json`) so HOLMES can verify claims.

## Non‑Goals (MVP)

- Full analytics DSL, window functions, or arbitrary SQL expressions across the graph.
- Automatic materialized view maintenance or cost‑based join optimization.
- Mutation compilation beyond CRUD already handled by RPC synthesis; bespoke writes may continue to use `@function` in MVP.

## Prior Art and Fit

- Wesley already harvests operations and synthesizes CRUD RPCs (see `RPCFunctionGeneratorV2`).
- SQL emission uses a small SQL AST (`SQLAst.mjs`) to avoid brittle string templates.
- This RFC adds a sibling module: a QIR and compiler that translate GraphQL operation documents into relational plans.

---

## Minimal QIR (Query IR)

A compact, composable IR that captures the relational essence of a GraphQL selection. TypeScript-ish definitions:

```ts
// Base nodes
interface QueryPlan { root: RelationNode; projection: Projection; orderBy?: OrderBy[]; limit?: number; offset?: number; }

interface RelationNode { kind: 'Table'|'Join'|'Subquery'|'Lateral'; alias: string; }

interface TableNode extends RelationNode { kind: 'Table'; table: string; }

interface JoinNode extends RelationNode {
  kind: 'Join';
  left: RelationNode; right: RelationNode; joinType: 'INNER'|'LEFT'; on: Predicate;
}

interface SubqueryNode extends RelationNode { kind: 'Subquery'; plan: QueryPlan; }
interface LateralNode extends RelationNode { kind: 'Lateral'; plan: QueryPlan; }

// Selection
interface Projection { items: ProjectionItem[]; }

interface ProjectionItem {
  alias: string; // GraphQL field alias/name
  expr: Expr;    // ColumnRef | FuncCall | JsonBuildObject | ScalarSubquery
}

// Expressions & Predicates
interface ColumnRef { kind: 'ColumnRef'; table: string; column: string; }
interface ParamRef { kind: 'ParamRef'; name: string; special?: 'auth_uid'|'tenant'; }
interface Literal { kind: 'Literal'; value: string|number|boolean|null; type?: string; }
interface FuncCall { kind: 'FuncCall'; name: string; args: Expr[]; }
interface ScalarSubquery { kind: 'ScalarSubquery'; plan: QueryPlan; }
interface JsonBuildObject { kind: 'JsonBuildObject'; fields: { key: string; value: Expr; }[]; }
interface JsonAgg { kind: 'JsonAgg'; value: Expr; orderBy?: OrderBy[]; }

interface Predicate {
  kind: 'And'|'Or'|'Not'|'Compare'|'Exists'|'IsNull'|'IsNotNull';
  left?: Predicate|Expr; right?: Predicate|Expr; op?: 'eq'|'ne'|'lt'|'lte'|'gt'|'gte'|'ilike'|'contains'|'in';
  subquery?: QueryPlan; // for Exists
}

interface OrderBy { expr: Expr; direction: 'asc'|'desc'; nulls?: 'first'|'last'; }

type Expr = ColumnRef | ParamRef | Literal | FuncCall | JsonBuildObject | JsonAgg | ScalarSubquery;
```

Key design choices:
- Preserve nested GraphQL shapes using `LATERAL` subqueries plus `json_build_object`/`json_agg` in the projection to avoid row multiplication.
- Use `Exists` predicates for `some/every/none` list filters.
- Maintain a stable parameter binding order gathered during compilation of filters/limits/offsets.

---

## Operation → QIR → SQL: Compiler Plan

Pipeline stages and responsibilities:

1) Parse GraphQL operation document
- Build an operation AST (variable defs, root field, selection set).
- Validate root fields map to known tables or synthesized roots.

2) Schema mapping
- Resolve types to tables (`type Organization @wes_table` → `organization`).
- Map fields to columns or computed expressions; derive relationships from `@wes_fk`, `@wes_hasMany`, etc.

3) Build QIR
- Create a `TableNode` for the root (alias `t0`).
- For each selected field:
  - Scalar: `ProjectionItem` with `ColumnRef('t0', column)` or computed `FuncCall`.
  - Object relation (1:1 / many:1): add `JoinNode` with alias `tN`; project columns from `tN` or a `JsonBuildObject` if nesting should be materialized.
  - List relation (1:N): add a `LateralNode` whose plan selects the child rows and projects a `JsonAgg(JsonBuildObject(...))` as the single projected value.
- For filters (`where` input): recursively translate into `Predicate` trees using `Compare`/`And`/`Or`/`Exists`/`IsNull`/`IsNotNull`.
- For aggregates in scalar context (e.g., `membersCount`): use `ScalarSubquery` rather than GROUP BY to avoid wide grouping.

4) Parameterization & auth
- Replace variable references with `ParamRef` and produce a deterministic `$1..$N` order.
- Special context bindings: use a spec‑compliant variable like `$auth_uid`, then compile per target:
  - Supabase: inline `auth.uid()` in predicates.
  - Vanilla Postgres: bind from session via `current_setting('app.user_id', true)` or pass as a normal parameter.
- If `@wes_rls(enabled: true)` on the base table, prefer relying on RLS for row filtering (see decision table); otherwise inject owner/tenant predicates derived from directives.

5) Lower QIR to SQL AST
- Translate QIR nodes to existing `SQLAst` constructs where possible; use raw fragments for `LATERAL` initially if needed.
- Emit SELECT with FROM, JOIN/LATERAL, WHERE, ORDER BY, LIMIT/OFFSET.
- Materialize nested fields as JSON objects/arrays in projection.

6) Choose output form
- Direct SQL text (client-only use), or
- `CREATE VIEW <name> AS <select>` when no dynamic args, or
- `CREATE FUNCTION <name>(args...) RETURNS SETOF <table>|jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$ RETURN QUERY <select>; $$;` when dynamic args are present.

7) Evidence & tests
- Add evidence-map entries tying each projected field to a `file:line@sha` source and emitted SQL target.
- Generate minimal pgTAP tests: shape check (columns/JSON keys), parameter binding order, and predicate correctness for simple cases.

---

## Example: "My Organizations"

GraphQL operation (pure GraphQL; spec‑compliant auth variable):

```graphql
query MyOrganizations($limit: Int = 20, $offset: Int = 0, $auth_uid: ID) {
  organizations(
    where: { members: { some: { user_id: { eq: $auth_uid } } } }
    orderBy: [{ name: asc }]
    limit: $limit
    offset: $offset
  ) {
    id
    name
    membersCount
  }
}
```

Compiled SQL (flat rows + correlated count; Supabase binding shown):

```sql
SELECT
  o.id,
  o.name,
  (
    SELECT count(*)
    FROM membership m2
    WHERE m2.org_id = o.id
  ) AS "membersCount"
FROM organization o
WHERE EXISTS (
  SELECT 1
  FROM membership m1
  WHERE m1.org_id = o.id
    AND m1.user_id = auth.uid()
)
ORDER BY o.name ASC
LIMIT $1 OFFSET $2;
```

Alternate compiled SQL (nested list via LATERAL json_agg):

```sql
SELECT
  o.id,
  o.name,
  members_json.members AS "members"
FROM organization o
LEFT JOIN LATERAL (
  SELECT json_agg(json_build_object(
    'user_id', m.user_id,
    'role', m.role
  ) ORDER BY m.created_at DESC) AS members
  FROM membership m
  WHERE m.org_id = o.id
) AS members_json ON true
WHERE EXISTS (
  SELECT 1 FROM membership m1
  WHERE m1.org_id = o.id AND m1.user_id = auth.uid()
)
ORDER BY o.name ASC
LIMIT $1 OFFSET $2;
```

Parameter binding order: `$1 = $limit`, `$2 = $offset`. The `$auth_uid` variable is compiled per target (inline `auth.uid()` or a session/param binding).

---

## Filter DSL Mapping (MVP)

- Scalars: `{ field: { eq|ne|lt|lte|gt|gte|ilike|contains|in } }`
- Nullability: `{ field: { isNull: true } }`, `{ field: { isNotNull: true } }`
- Logical: `{ AND: [...], OR: [...], NOT: {...} }`
- Lists: `{ relation: { some|every|none: { ...predicate... } } }` → `EXISTS` / `NOT EXISTS` / double negation
- Timestamps: allow `string` inputs coerced with `::timestamptz` at compile time
- Arrays: `in: [ ... ]` binds as `$n::<pgType>[]`; empty list compiles to `false` (or `= ANY('{}'::<type>[])`) to avoid full‑table scans.

Examples:

- `{ name: { ilike: "%acme%" } }` → `o.name ILIKE $1`
- `{ created_at: { gte: "2025-01-01" } }` → `o.created_at >= $1::timestamptz`
- `{ members: { some: { user_id: { eq: $auth_uid } } } }` → `EXISTS (SELECT 1 FROM membership m WHERE m.org_id = o.id AND m.user_id = auth.uid())`

---

## Null vs Empty List Semantics

- Missing optional relation (no row or relation absent): project `null`.
- Present relation with zero matching rows: project `[]` for lists, `null` for single object relations.
- Compiler uses LEFT JOIN (for 1:1/m:1) and LATERAL subqueries (for 1:N) to preserve GraphQL semantics.

---

## Security Model

### RLS‑First Decision Table (MVP)

| Base table has @wes_rls | Caller filters include owner/tenant | Compiler injects owner/tenant predicate? |
|-------------------------|------------------------------------|------------------------------------------|
| yes                     | any                                | no (rely on RLS)                         |
| no                      | none                               | yes (derive from @wes_owner/@wes_tenant) |
| no                      | explicit owner/tenant filters       | no (avoid duplication)                   |

Notes:
- The compiler never narrows results twice. If the caller supplies explicit owner/tenant filters, we do not add derived predicates.
- Prefer RLS when available; tests enforce that policies exist if `@wes_rls(enabled: true)` is declared.

### Function Hardening Defaults

- Prefer `SECURITY INVOKER` when RLS fully covers access; otherwise `SECURITY DEFINER` with:
  - `SET search_path = pg_catalog, <app_schema>` (avoid `public` if possible).
  - Minimal privileges: owner is a dedicated role; explicit `GRANT EXECUTE` per role (`@wes_grant` or defaults).
- Auth portability: `$auth_uid` compiles to `auth.uid()` (Supabase) or `current_setting('app.user_id', true)` (vanilla Postgres) based on config.

---

## Determinism & Stability

- Stable aliasing: table aliases `t0..tN` assigned in DFS and reused consistently.
- Stable parameter order: variables are bound in deterministic visitation order (documented), producing stable `$1..$N` numbering.
- Deterministic projection ordering: preserve GraphQL field order; sort JSON object keys when materializing nested objects for snapshot stability.
- Evidence keys: hash(operationName + normalized selection) to anchor evidence entries rather than raw file:line that may drift.

---

## Output Artifacts & Zero‑Downtime Versioning

- No args → `CREATE VIEW q_<op>_v1 AS <select>`
- Args present → `CREATE FUNCTION q_<op>_v1(args...) RETURNS SETOF <table>|jsonb ...`
- Expand/Switch/Contract for shape changes:
  1) Create new version (`_v2`) alongside `_v1`.
  2) Switch: update dependents (or publish a shim view/function) to point at `_v2`.
  3) Contract: drop `_v1` once no dependents remain (planner explains lock levels).

---

## Artifacts & Integration

- New input folder: `ops/` (configurable) for operation documents.
- CLI: `wesley generate --ops ops/` compiles operations to:
  - `generated/sql/views/*.sql` and/or `generated/sql/rpc/*.sql`
  - TypeScript operation types + Zod validators
  - Evidence entries in `.wesley/evidence-map.json`
- HOLMES: consumes evidence to score operation coverage (SCS/TCI dimensions for ops).
- Config knobs (`wesley.config.mjs`): ops folder, target (supabase/postgres), output preference (view/function), RLS reliance strategy, nested list shaping guardrails.

---

## Performance Guardrails (MVP)

- Nested lists require explicit `orderBy` and `limit` (compiler warns or fails otherwise).
- Prefer correlated subqueries for counts; V2 may rewrite to GROUP BY when safe.
- Index suggestions: compiler emits hints (non-blocking) when predicates lack supporting indexes.
- Option to prefer JOIN + grouping over LATERAL for certain 1:1/m:1 shapes (configurable).

---

## Phased Plan

1) MVP
- Implement QIR data structures and a conservative compiler for: single root table, scalar projections, simple joins, EXISTS filters, `isNull/isNotNull`, order/limit/offset, nested lists via LATERAL json_agg.
- Output: parameterized SELECT and optional RPC function wrapper `RETURNS SETOF <table>|jsonb`.
- Tests: snapshot SQL + pgTAP shape tests; evidence map coverage.

2) V2
- Add GROUP BY compilation when aggregates mix intentionally with scalars.
- Pagination for nested lists.
- Computed field expressions via `@wes_expr(select: ...)` in the schema.

3) V3
- Cost-aware join order heuristics, optional materialized views, partial index suggestions.

---

## Acceptance Criteria (MVP)

- Given an operation like MyOrganizations above, `wesley generate --ops ops/` emits:
  - a stable, parameterized SQL statement (and optional function wrapper),
  - TS/Zod client types for the operation’s variables and result,
  - pgTAP tests validating column presence and parameter order,
  - evidence map entries tying GraphQL fields to SQL.
- All additions gated by unit tests; no regressions in existing CLI workflows.

---

## Prototype: Compiler Outline (Pseudo‑Code)

```ts
function compileOperation(op: GQLOperation, schema: WesleySchema): CompiledSQL {
  const env = new CompileEnv(schema);
  const rootTable = env.resolveRoot(op.rootField);
  const root = TableNode({ table: rootTable, alias: env.alias('t') });

  const plan: QueryPlan = { root, projection: { items: [] } };

  // WHERE
  if (op.args.where) {
    plan.root = attachWhere(plan.root, compilePredicate(op.args.where, env));
  }

  // ORDER & PAGINATION
  plan.orderBy = compileOrder(op.args.orderBy, env);
  plan.limit = op.args.limit ?? null;
  plan.offset = op.args.offset ?? null;

  // PROJECTION
  for (const field of op.selection) {
    if (env.isScalar(rootTable, field)) {
      plan.projection.items.push({ alias: field.alias, expr: ColumnRef(root.alias, env.column(rootTable, field.name)) });
    } else if (env.isOneToOne(rootTable, field)) {
      const j = JoinNode({ left: root, right: TableNode({ table: env.tableOf(field), alias: env.alias('t') }), joinType: 'LEFT', on: env.joinOn(root, field) });
      plan.root = j; // or accumulate joins in FROM clause
      plan.projection.items.push({ alias: field.alias, expr: JsonBuildObject(env.scalarFields(field)) });
    } else if (env.isOneToMany(rootTable, field)) {
      const child = TableNode({ table: env.tableOf(field), alias: env.alias('t') });
      const childPlan: QueryPlan = {
        root: child,
        projection: { items: [ { alias: '_', expr: JsonBuildObject(env.scalarFields(field)) } ] },
        orderBy: compileOrder(field.args.orderBy, env),
        limit: field.args.limit, offset: field.args.offset,
      };
      childPlan.root = attachWhere(childPlan.root, env.joinChildOnParent(child, root, field));
      const lateral = LateralNode({ plan: childPlan, alias: env.alias('l') });
      plan.root = attachLateral(plan.root, lateral);
      plan.projection.items.push({ alias: field.alias, expr: JsonAgg(ScalarSubquery(childPlan)) });
    }
  }

  // PARAMS
  const { sql, params } = lowerToSQL(plan, env.paramOrder());
  return { sql, params };
}
```

---

## Appendix: RLS Decision Table (copy‑paste)

| RLS on base | Caller provides owner/tenant filters | Inject derived owner/tenant? |
|-------------|-------------------------------------|------------------------------|
| yes         | any                                 | no                           |
| no          | none                                | yes                          |
| no          | explicit                             | no                           |

