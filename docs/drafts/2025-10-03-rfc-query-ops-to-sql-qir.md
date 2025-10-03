# RFC: Compile GraphQL Operations to SQL via a Query IR (QIR)

- Status: Draft
- Date: 2025-10-03
- Owner: Core Team
- Discussed In: docs/architecture/overview.md, docs/architecture/paradigm-shift.md
- Related: packages/wesley-core/src/domain/{GraphQLSchemaBuilder.mjs,OperationRegistry.mjs,SQLAst.mjs}, packages/wesley-core/src/domain/generators/RPCFunctionGeneratorV2.mjs, packages/wesley-generator-supabase/src/rpc.mjs

## Summary

Wesley inverts the traditional “DB → GraphQL” flow: a single GraphQL schema becomes DDL, migrations, types, tests, and evidence. Today, custom read/write operations are supported by embedding SQL/PLpgSQL strings in directives like `@rpc(sql: ...)` or `@function(logic: ...)`. That is expedient, but it isn’t idiomatic GraphQL and undermines the “one declarative language” story.

This RFC proposes a first-class pipeline to compile actual GraphQL operation documents (queries/mutations) into safe, parameterized SQL (views or functions) using a minimal Query IR (QIR). The goal is to express intent purely in GraphQL and let Wesley generate the correct relational plan and artifacts, while respecting RLS, tenant/owner directives, and zero-downtime philosophy.

## Goals

- Allow operators to define read operations as standard GraphQL queries (documents), not inline SQL.
- Compile to parameterized SQL (or views/functions) that preserve GraphQL result shape and performance expectations.
- Integrate with existing mappings (types→tables, fields→columns, relationships via directives).
- Respect security/tenancy (`@wes_rls`, `@wes_owner`, `@wes_tenant`) and avoid duplicating RLS logic when enabled.
- Emit evidence (citations into `.wesley/evidence-map.json`) so HOLMES can verify claims.

## Non‑Goals (MVP)

- Full analytics DSL, window functions, or arbitrary SQL expressions across the graph.
- Automatic materialized view maintenance or cost‑based join optimization.
- Mutation compilation beyond CRUD that is already handled by RPC synthesis; custom write logic may still use `@function` in MVP.

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
interface ParamRef { kind: 'ParamRef'; name: string; special?: 'auth.uid'|'tenant'; }
interface Literal { kind: 'Literal'; value: string|number|boolean|null; type?: string; }
interface FuncCall { kind: 'FuncCall'; name: string; args: Expr[]; }
interface ScalarSubquery { kind: 'ScalarSubquery'; plan: QueryPlan; }
interface JsonBuildObject { kind: 'JsonBuildObject'; fields: { key: string; value: Expr; }[]; }
interface JsonAgg { kind: 'JsonAgg'; value: Expr; orderBy?: OrderBy[]; }

interface Predicate {
  kind: 'And'|'Or'|'Not'|'Compare'|'Exists';
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
- For filters (`where` input): recursively translate into `Predicate` trees using `Compare`/`And`/`Or`/`Exists`.
- For aggregates in scalar context (e.g., `membersCount`): use `ScalarSubquery` rather than GROUP BY to avoid wide grouping.

4) Parameterization & auth
- Replace variable references with `ParamRef` and produce a deterministic `$1..$N` order.
- Special tokens: `$auth.uid` → `ParamRef{ special: 'auth.uid' }` that compiles to `auth.uid()` (or a bound param in non-Supabase contexts).
- If `@wes_rls(enabled: true)` on the base table, prefer relying on RLS for row filtering; otherwise inject owner/tenant predicates derived from directives.

5) Lower QIR to SQL AST
- Translate QIR nodes to existing `SQLAst` constructs where possible; use raw fragments for `LATERAL` if needed initially.
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

GraphQL operation (pure GraphQL; no SQL in directives):

```graphql
query MyOrganizations($limit: Int = 20, $offset: Int = 0) {
  organizations(
    where: { members: { some: { user_id: { eq: $auth.uid } } } }
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

Compiled SQL (flat rows + correlated count):

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

Parameter binding order: `$1 = $limit`, `$2 = $offset` (auth.uid compiled inline). In non-Supabase contexts, `$auth.uid` can be compiled to a bound `$N` provided by session.

---

## Filter DSL Mapping (MVP)

- Scalars: `{ field: { eq|ne|lt|lte|gt|gte|ilike|contains|in } }`
- Logical: `{ AND: [...], OR: [...], NOT: {...} }`
- Lists: `{ relation: { some|every|none: { ...predicate... } } }` → `EXISTS` / `NOT EXISTS` / double negation
- Timestamps: allow `string` inputs coerced with `::timestamptz` at compile time

Examples:

- `{ name: { ilike: "%acme%" } }` → `o.name ILIKE $1`
- `{ created_at: { gte: "2025-01-01" } }` → `o.created_at >= $1::timestamptz`
- `{ members: { some: { user_id: { eq: $auth.uid } } } }` → `EXISTS (SELECT 1 FROM membership m WHERE m.org_id = o.id AND m.user_id = auth.uid())`

---

## Security Model

- Prefer RLS: if `@wes_rls(enabled: true)` is present on the base table, rely on it and do not duplicate predicates.
- Ownership/Tenancy: when RLS is absent, derive predicates from `@wes_owner(column: ...)` and `@wes_tenant(by: ...)`.
- All literals parameterized; no string concatenation from user inputs.
- Functions emitted as `SECURITY DEFINER` with explicit `GRANT EXECUTE` per roles from `@wes_grant` or sensible defaults.

---

## Artifacts & Integration

- New input folder: `ops/` (configurable) for operation documents.
- CLI: `wesley generate --ops ops/` compiles operations to:
  - `generated/sql/views/*.sql` and/or `generated/sql/rpc/*.sql`
  - TypeScript operation types + Zod validators
  - Evidence entries in `.wesley/evidence-map.json`
- HOLMES: consumes evidence to score SCS/TCI coverage for operations (e.g., “operation has SQL + TS + Zod + tests”).

---

## Phased Plan

1) MVP (this RFC)
- Implement QIR data structures and a conservative compiler for: single root table, scalar projections, simple joins, EXISTS filters, order/limit/offset, nested lists via LATERAL json_agg.
- Output: parameterized SELECT and optional RPC function wrapper `RETURNS SETOF <table>|jsonb`.
- Tests: snapshot SQL + pgTAP shape tests; evidence map coverage.

2) V2
- Add GROUP BY compilation path when aggregates mix with scalars intentionally.
- Add pagination for nested lists (`field(limit, offset, orderBy)` on LATERAL plans).
- Support computed field expressions via `@wes_expr(select: ...)` in the schema.

3) V3
- Cost-aware join order heuristics, materialized views (optional), partial indexes suggestions.

---

## Compatibility & Migration

- Existing `@rpc(sql: ...)` and `@function(logic: ...)` remain supported as escape hatches.
- Prefer canonical `@wes_*` schema directives; operation documents are pure GraphQL.
- No workflow changes; main CI remains lean with evidence + tests for operations enabled where available.

---

## Open Questions

- Composite return types: Should the compiler emit Postgres composite types to mirror ad‑hoc shapes, or default to `jsonb` for non-table projections?
- Auth context: In non‑Supabase environments, how should `$auth.uid` be provided (GUC, session var, bound param)?
- N+1 vs shaping: When should we favor JOINs vs LATERAL subqueries for nested objects to balance performance and JSON shaping?

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

## Appendix: Mapping Cheatsheet

- `some` → `EXISTS (SELECT 1 FROM child WHERE child.fk = parent.pk AND <pred>)`
- `none` → `NOT EXISTS ( ... )`
- `every` → `NOT EXISTS (SELECT 1 FROM child WHERE child.fk = parent.pk AND NOT(<pred>))`
- Nested lists → `LEFT JOIN LATERAL (SELECT json_agg(json_build_object(...)) ...)` and project as a single JSON column
- Aggregated scalar in flat row → correlated subquery in projection

---

## Call for Review

Feedback requested on:
- QIR scope sufficiency for MVP
- Output form defaults (SETOF table vs jsonb)
- Security posture (RLS reliance vs explicit predicates)
- Performance implications of LATERAL shaping defaults

If accepted, we will stage behind a `--ops` feature flag and land a minimal compiler, tests, and documentation, without touching destructive planner logic.
