# Example Operations (Experimental JSON DSL)

These files demonstrate the minimal JSON DSL that Wesley’s experimental `--ops` path can compile to SQL (QIR → SQL). The DSL expresses:

- Root table (`table`) and projected columns (`columns`)
- Filters (`filters`) with params→`ParamRef` (e.g., `{ "param": { "name": "q", "type": "text" } }`)
- Ordering, limit/offset
- Nested lists via `LATERAL` + `jsonb_agg` (`lists`)

Compile ops:

```bash
node packages/wesley-host-node/bin/wesley.mjs generate \
  --schema test/fixtures/examples/ecommerce.graphql \
  --ops test/fixtures/examples/ops \
  --emit-bundle \
  --out-dir out/examples \
  --allow-dirty
```

Outputs land in `out/examples/ops/` as both a `CREATE VIEW` and a `CREATE FUNCTION` per operation.

## DSL Reference (MVP)

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

Nested list (LATERAL + jsonb_agg):

```json
{
  "name": "orders_with_items_by_user",
  "table": "order",
  "columns": ["id", "order_number", "status"],
  "filters": [ { "column": "user_id", "op": "eq", "param": { "name": "user_id", "type": "uuid" } } ],
  "lists": [
    {
      "alias": "items",
      "table": "orderitem",
      "match": { "local": "id", "foreign": "order_id" },
      "select": ["id", "product_id", "quantity"],
      "orderBy": [ { "column": "id", "dir": "asc" } ]
    }
  ],
  "orderBy": [ { "column": "created_at", "dir": "desc" } ]
}
```

## Preview EXPLAIN (FORMAT JSON)

After applying the generated schema and ops SQL to a Postgres database:

```bash
# Function call EXPLAIN
psql -d <db> -t -A -c "EXPLAIN (FORMAT JSON) SELECT * FROM wes_ops.op_products_by_name('Al%')" \
  > out/examples/ops/explain/products_by_name.explain.json
```

Note: The DSL is experimental; joins, distinct, pagination, and deeper composition will expand in future phases. See docs/guides/qir-ops.md for the QIR lowering/emission guide.

## Consuming Tests

- `test/holmes-e2e.bats` generates bundles that include QIR outputs compiled from these operations.
- Future QIR smoke tests will continue to point at this directory—treat filenames as stable contract.

## Validation & Error Handling

Required fields:
- `name` (string), `table` (string)

Optional fields:
- `columns` (array of non-empty strings) — omit or [] for SELECT *
- `filters` (array) — allowed ops: eq, ne, lt, lte, gt, gte, like, ilike, contains, in, isNull, isNotNull
- `orderBy` (array) — `dir`: asc|desc; `nulls`: first|last (optional)
- `limit` (>0 integer), `offset` (>=0 integer)
- `joins` (array) — each join requires `table` (string) and `on` with `{ left, right, op }`
- `lists` (array) — each list requires `table` and either `match` `{ local, foreign }` and/or `filters`

The builder validates inputs and throws descriptive errors when values are missing or invalid (field name, offending value, expected shape). Identifiers should be trusted schema-derived names; user input must not be used for table/column/alias names.
