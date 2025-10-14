# Running Query Operations with `wesley --ops` (Experimental)

Status: experimental and opt-in. Generated SQL is not applied automatically—you own the review and deployment.

> [!CAUTION]
> The current compiler emits identifiers *without* defensive quoting. Only feed trusted GraphQL schemas and operation definitions into `--ops`. Never interpolate user-controlled strings into an op file. If an attacker can inject a table or column name they can execute arbitrary SQL. Until the compiler grows full quoting support, treat the output as sensitive infrastructure code and review it like hand-written SQL.

---

## Quick start: from GraphQL to executable SQL

1. **Describe the data shape** (GraphQL SDL):
   ```graphql
   # schema.graphql
   type Product @wes_table {
     id: ID! @wes_pk
     name: String!
     slug: String! @wes_unique
     price_cents: Int!
     published: Boolean! @wes_default(value: "false")
   }
   ```

2. **Define the operation** (`ops/products_by_name.op.json`):
   ```json
   {
     "name": "products_by_name",
     "table": "product",
     "columns": ["id", "name", "slug", "price_cents"],
     "filters": [
       { "column": "published", "op": "eq", "value": true },
       { "column": "name", "op": "ilike", "param": { "name": "q", "type": "text" } }
     ],
     "orderBy": [{ "column": "name", "dir": "asc" }],
     "limit": 25
   }
   ```

3. **Compile the operation**:
   ```bash
   node packages/wesley-host-node/bin/wesley.mjs generate \
     --schema schema.graphql \
     --ops ops \
     --out-dir out
   ```

4. **Review the generated SQL** (`out/ops/products_by_name.fn.sql` excerpt):
   ```sql
   CREATE OR REPLACE FUNCTION wes_ops.op_products_by_name(p_q text)
   RETURNS SETOF jsonb
   LANGUAGE sql
   STABLE
   AS $$
     SELECT to_jsonb(q.*)
     FROM (
       SELECT
         t0.id,
         t0.name,
         t0.slug,
         t0.price_cents
       FROM product t0
       WHERE t0.published = true
         AND t0.name ILIKE p_q
       ORDER BY t0.name ASC, t0.id ASC
       LIMIT 25
     ) AS q;
   $$;
   ```
   Parameterless operations also emit a view (`out/ops/products_by_name.view.sql`) for easy querying.

---

## Operation file anatomy

| Field          | Required | Description                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `name`         | ✅       | Human-readable identifier. Normalised to create SQL object names.           |
| `table`        | ✅       | Root table in the GraphQL schema.                                           |
| `columns`      | ✅       | Columns (fields) to project.                                                |
| `filters`      | ⭕       | Array of predicates (`op` ∈ `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `ilike`, `in`). Can reference literal `value` or `param`. |
| `orderBy`      | ⭕       | Sorting rules with `column` and `dir` (`asc`|`desc`).                        |
| `limit`/`offset` | ⭕     | Pagination.                                                                  |
| `param` within filter | ⭕ | Describes a parameter: `{ "name": "q", "type": "text" }`. Supported types mirror GraphQL scalars. |

All fields are lower_snake_case to match PostgreSQL conventions. See `packages/wesley-cli/src/commands/generate.mjs` for the authoritative JSON schema.

---

## CLI behaviour and flags

| Flag | Meaning |
| --- | --- |
| `--ops <dir>` | Compile every `*.op.json` in the directory (non-recursive). Missing directories or empty matches are skipped with an info log. |
| `--ops-schema <name>` | Override the schema used for generated SQL (`wes_ops` by default). |
| `--ops-allow-errors` | Continue compiling after a failure. Disabled when `CI=true` unless `--i-know-what-im-doing` is also set. |
| `--emit-bundle` | Still works: generated SQL is included in the evidence bundle for HOLMES. |

Other `generate` options (e.g., `--out-dir`, `--allow-dirty`) behave as usual.

Execution summary:
1. Read and parse the GraphQL schema.
2. Discover operation files (`fs.readdir`, filtered by `.op.json`).
3. Parse JSON → build QIR → emit SQL using `emitFunction` / `emitView`.
4. Write results to `<out-dir>/ops/*.fn.sql` (and `.view.sql` when paramless).

---

## Generated artifacts

- `ops/<name>.fn.sql` — always emitted. Exposes a `wes_ops.op_<name>(…) RETURNS SETOF jsonb` function.
- `ops/<name>.view.sql` — emitted when the operation takes no parameters. Creates a read-only view for convenience.
- SQL is idempotent; rerunning `generate` overwrites the same files.

Apply manually (e.g. with `psql`):
```bash
psql "$DATABASE_URL" -f out/ops/products_by_name.fn.sql
psql "$DATABASE_URL" -f out/ops/products_by_name.view.sql  # if present
```

---

## Identifier handling & error codes

| Situation | Behaviour | Code |
| --------- | --------- | ---- |
| Normalisation removes all characters (e.g. name is `"***"`). | Falls back to `unnamed`. | — |
| Sanitised name begins with a digit. | Prefixed with `_`. | — |
| Sanitised (or prefixed) name exceeds PostgreSQL’s 63-byte limit. | Compilation aborts. | `OPS_IDENTIFIER_TOO_LONG` |
| Two files normalise to the same identifier. | Compilation aborts; logs both paths. | `OPS_COLLISION` |
| Invalid JSON / unknown fields. | Compilation aborts. | `OPS_PARSE_FAILED` |
| Directory missing or no matches. | Logged at info level; no SQL emitted. | — |

Identifiers are currently emitted without quoting. Keep names simple, avoid reserved words, and prefer ASCII where possible.

---

## Testing & extending the compiler

| Area | What it covers | How to run | Adding coverage |
| ---- | -------------- | ---------- | --------------- |
| QIR unit tests (`packages/wesley-core/test/unit/qir-*.test.mjs`) | Node shape builders, predicate compilation, parameter ordering. | `pnpm -C packages/wesley-core test:unit` | Add a new `.test.mjs` case for your predicate/plan behaviour. |
| Emission snapshots (`packages/wesley-core/test/snapshots/qir-emission.test.mjs`) | Generated SQL for canonical operations, including `jsonb_agg` and tie-breakers. | `pnpm -C packages/wesley-core test:snapshots` | Update the fixture QIR plan and snapshot to reflect new SQL shapes. |
| CLI discovery tests (`packages/wesley-cli/test/ops-*.bats`) | `--ops` flag wiring, identifier sanitisation, CI guard rails. | `pnpm --filter @wesley/cli test` | Add a bats test with a dedicated `ops/` fixture to reproduce your scenario. |

When introducing a new DSL feature:
1. Extend the JSON parser in `generate.mjs` (or dedicated builder).
2. Add unit coverage for the QIR node / lowering.
3. Add or update emission snapshots.
4. Add a CLI bats test to confirm discovery and error-handling behaviour.

---

## Known limitations

- Non-recursive discovery: only the top-level of `--ops <dir>` is scanned.
- Identifiers are not quoted: stick to trusted schemas and review output.
- Functions always return `SETOF jsonb` and emission assumes `wes_ops`. Override the schema with `--ops-schema` if needed.
- Ordering tie-breakers assume the root table’s primary key is `<alias>.id`.
- No automatic validation of referenced indexes: run `EXPLAIN (FORMAT JSON)` (or rely on the HOLMES workflow) to verify performance characteristics.

Have ideas or need additional features? Open an issue with concrete scenarios so we can prioritise safely expanding the compiler.
