-- pgTAP smoke tests: parameterized function (products_by_name.op.json)
-- Tests that a parameterized operation emits a function with correct signature.

BEGIN;
SELECT plan(5);

-- 1. Schema exists
SELECT has_schema('wes_ops', 'wes_ops schema exists');

-- 2. Function exists with correct parameter type
SELECT has_function(
  'wes_ops', 'op_products_by_name', ARRAY['text'],
  'op_products_by_name(text) function exists'
);

-- 3. Match: 'Al%' should find 'Alpha' (published, matches ILIKE)
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_products_by_name('Al%')),
  1::bigint,
  'op_products_by_name(Al%) returns 1 matching published product'
);

-- 4. No match: 'NOPE%' should find nothing
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_products_by_name('NOPE%')),
  0::bigint,
  'op_products_by_name(NOPE%) returns 0 rows'
);

-- 5. Returned jsonb has exactly the projected keys (id, name, slug — no price_cents)
SELECT ok(
  (SELECT bool_and(
    row_data ? 'id'
    AND row_data ? 'name'
    AND row_data ? 'slug'
    AND NOT (row_data ? 'price_cents')
  ) FROM wes_ops.op_products_by_name('Al%') AS row_data),
  'every row from op_products_by_name has id, name, slug (no price_cents)'
);

SELECT finish();
ROLLBACK;
