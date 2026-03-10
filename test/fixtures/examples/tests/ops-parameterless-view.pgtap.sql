-- pgTAP smoke tests: parameterless view (all_products.graphql)
-- Tests that a parameterless operation emits both a view and a zero-arg function.

BEGIN;
SELECT plan(6);

-- 1. Schema exists
SELECT has_schema('wes_ops', 'wes_ops schema exists');

-- 2. View exists
SELECT has_view('wes_ops', 'op_all_products', 'op_all_products view exists');

-- 3. Zero-arg function exists
SELECT has_function(
  'wes_ops', 'op_all_products', '{}'::text[],
  'op_all_products() function exists with zero params'
);

-- 4. View returns seeded rows (2 products: Alpha published, Beta unpublished)
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_all_products),
  2::bigint,
  'op_all_products view returns all seeded products'
);

-- 5–6. Each row has expected jsonb keys (id, name, slug, price_cents)
SELECT ok(
  (SELECT bool_and(
    row_data ? 'id'
    AND row_data ? 'name'
    AND row_data ? 'slug'
    AND row_data ? 'price_cents'
  ) FROM wes_ops.op_all_products() AS row_data),
  'every row from op_all_products() has id, name, slug, price_cents keys'
);

SELECT ok(
  (SELECT bool_and(
    row_data ? 'id'
    AND row_data ? 'name'
    AND row_data ? 'slug'
    AND row_data ? 'price_cents'
  ) FROM (SELECT to_jsonb(v.*) AS row_data FROM wes_ops.op_all_products v) sub),
  'every row from op_all_products view has id, name, slug, price_cents keys'
);

SELECT finish();
ROLLBACK;
