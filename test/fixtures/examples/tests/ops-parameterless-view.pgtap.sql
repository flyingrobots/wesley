-- pgTAP smoke tests: parameterless view (all_products.graphql)
-- Tests that a parameterless operation emits both a view and a zero-arg function.
-- Sanitized name: "allproducts" (no underscore — GraphQL operation name "AllProducts"
-- is lowercased and non-alpha chars stripped by sanitizeIdentBase).

BEGIN;
SELECT plan(7);

-- 1. Schema exists
SELECT has_schema('wes_ops', 'wes_ops schema exists');

-- 2. View exists
SELECT has_view('wes_ops', 'op_allproducts', 'op_allproducts view exists');

-- 3. Zero-arg function exists
SELECT has_function(
  'wes_ops', 'op_allproducts', '{}'::text[],
  'op_allproducts() function exists with zero params'
);

-- 4. View returns seeded rows (2 products total — no published filter in this op)
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_allproducts),
  2::bigint,
  'op_allproducts view returns all seeded products'
);

-- 5. View and function return the same row count (parity check)
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_allproducts),
  (SELECT count(*)::bigint FROM wes_ops.op_allproducts()),
  'op_allproducts view and function return the same row count'
);

-- 6–7. Each row has expected jsonb keys (id, name, slug, price_cents)
SELECT ok(
  (SELECT bool_and(
    row_data ? 'id'
    AND row_data ? 'name'
    AND row_data ? 'slug'
    AND row_data ? 'price_cents'
  ) FROM wes_ops.op_allproducts() AS row_data),
  'every row from op_allproducts() has id, name, slug, price_cents keys'
);

SELECT ok(
  (SELECT bool_and(
    row_data ? 'id'
    AND row_data ? 'name'
    AND row_data ? 'slug'
    AND row_data ? 'price_cents'
  ) FROM (SELECT to_jsonb(v.*) AS row_data FROM wes_ops.op_allproducts v) sub),
  'every row from op_allproducts view has id, name, slug, price_cents keys'
);

SELECT finish();
ROLLBACK;
