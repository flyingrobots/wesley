-- pgTAP smoke tests: nested LATERAL join (orders_with_items_by_user.op.json)
-- Tests that a LATERAL join operation emits a function with nested jsonb arrays.

BEGIN;
SELECT plan(5);

-- 1. Schema exists
SELECT has_schema('wes_ops', 'wes_ops schema exists');

-- 2. Function exists with uuid parameter
SELECT has_function(
  'wes_ops', 'op_orders_with_items_by_user', ARRAY['uuid'],
  'op_orders_with_items_by_user(uuid) function exists'
);

-- 3. Seeded user has 1 order
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_orders_with_items_by_user(
    '00000000-0000-0000-0000-000000000001'::uuid
  )),
  1::bigint,
  'op_orders_with_items_by_user returns 1 order for seeded user'
);

-- 4. Returned jsonb has expected top-level keys (id, order_number, status, items)
SELECT ok(
  (SELECT bool_and(
    row_data ? 'id'
    AND row_data ? 'order_number'
    AND row_data ? 'status'
    AND row_data ? 'items'
  ) FROM wes_ops.op_orders_with_items_by_user(
    '00000000-0000-0000-0000-000000000001'::uuid
  ) AS row_data),
  'every row has id, order_number, status, items keys'
);

-- 5. Nested items array has 2 order items
SELECT is(
  (SELECT jsonb_array_length(row_data -> 'items')
   FROM wes_ops.op_orders_with_items_by_user(
     '00000000-0000-0000-0000-000000000001'::uuid
   ) AS row_data
   LIMIT 1),
  2,
  'nested items array has 2 order items'
);

SELECT finish();
ROLLBACK;
