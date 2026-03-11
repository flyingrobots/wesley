-- pgTAP smoke tests: nested LATERAL join (orders_with_items_by_user.op.json)
-- Tests that a LATERAL join operation emits a function with nested jsonb arrays.

BEGIN;
SELECT plan(7);

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

-- 4. Negative case: non-existent user returns 0 rows (proves user_id predicate works)
SELECT is(
  (SELECT count(*)::bigint FROM wes_ops.op_orders_with_items_by_user(
    '00000000-0000-0000-0000-000000000002'::uuid
  )),
  0::bigint,
  'op_orders_with_items_by_user returns 0 orders for non-existent user'
);

-- 5. Returned jsonb has expected top-level keys (id, order_number, status, items)
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

-- 6. Every order's nested items array has 2 order items
SELECT ok(
  (SELECT bool_and(jsonb_array_length(row_data -> 'items') = 2)
   FROM wes_ops.op_orders_with_items_by_user(
     '00000000-0000-0000-0000-000000000001'::uuid
   ) AS row_data),
  'all orders have exactly 2 items'
);

-- 7. Each nested item has required keys (id, product_id, quantity)
SELECT ok(
  (SELECT bool_and(
    elem ? 'id'
    AND elem ? 'product_id'
    AND elem ? 'quantity'
  ) FROM wes_ops.op_orders_with_items_by_user(
    '00000000-0000-0000-0000-000000000001'::uuid
  ) AS row_data,
  LATERAL jsonb_array_elements(row_data -> 'items') AS elem),
  'every nested item has id, product_id, quantity keys'
);

SELECT finish();
ROLLBACK;
