-- pgTAP smoke tests for emitted ops (optional)
-- These tests are skipped if the pgtap extension is unavailable in the server.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgtap') THEN
    PERFORM plan(6);

    -- Existence
    PERFORM has_schema('wes_ops', 'wes_ops schema exists');
    PERFORM has_view('wes_ops', 'op_products_by_name', 'products view exists');
    PERFORM has_function('wes_ops', 'op_products_by_name(text)', 'products fn exists');
    PERFORM has_view('wes_ops', 'op_orders_by_user', 'orders view exists');
    PERFORM has_function('wes_ops', 'op_orders_by_user(uuid)', 'orders fn exists');

    -- Behavior (requires seed data applied by CI step)
    PERFORM is(
      (SELECT count(*) FROM wes_ops.op_products_by_name('Al%')),
      1::bigint,
      'op_products_by_name filters published products by name'
    );

    PERFORM finish();
  ELSE
    RAISE NOTICE 'pgtap not installed; skipping ops tests';
  END IF;
END
$$ LANGUAGE plpgsql;

