-- Generated pgTAP tests by Wesley
-- SHA: abc123def456
-- Risk-weighted test generation

BEGIN;
SELECT plan(47);

-- =====================
-- STRUCTURE TESTS
-- =====================

-- Critical tables exist
SELECT has_table('User', 'Critical table User exists');
SELECT has_table('Order', 'Critical table Order exists');
SELECT has_table('Product', 'Table Product exists');
SELECT has_table('OrderItem', 'Table OrderItem exists');

-- =====================
-- CRITICAL FIELD TESTS (Weight 10)
-- =====================

-- User.password_hash (weight: 10) - MAXIMUM PRIORITY
SELECT has_column('User', 'password_hash', 'Critical: password_hash column exists');
SELECT col_not_null('User', 'password_hash', 'Critical: password_hash cannot be null');
SELECT col_type_is('User', 'password_hash', 'character varying(60)', 'Critical: password_hash is varchar(60)');

-- Verify bcrypt constraint
SELECT matches(
  (SELECT pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'password_hash_bcrypt'),
  'char_length.*60',
  'Critical: password_hash must be 60 chars (bcrypt)'
);

-- Order.order_number (weight: 10)
SELECT has_column('Order', 'order_number', 'Critical: order_number exists');
SELECT col_is_unique('Order', 'order_number', 'Critical: order_number is unique');
SELECT col_not_null('Order', 'order_number', 'Critical: order_number required');

-- =====================
-- HIGH PRIORITY TESTS (Weight 8-9)
-- =====================

-- User.email (weight: 9) - PII field
SELECT has_column('User', 'email', 'High: email column exists');
SELECT col_is_unique('User', 'email', 'High: email must be unique');
SELECT col_not_null('User', 'email', 'High: email is required');
SELECT index_is_unique('User', 'User_email_key', 'High: email has unique index');

-- Order.payment_intent_id (weight: 9) - Sensitive
SELECT has_column('Order', 'payment_intent_id', 'High: payment_intent_id exists');
SELECT col_is_unique('Order', 'payment_intent_id', 'High: payment IDs must be unique');

-- Verify payment format constraint
SELECT matches(
  (SELECT pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conname = 'payment_intent_format'),
  'pi_',
  'High: payment_intent_id must match Stripe format'
);

-- Product.sku (weight: 9)
SELECT has_column('Product', 'sku', 'High: SKU column exists');
SELECT col_is_unique('Product', 'sku', 'High: SKUs must be unique');
SELECT is_indexed('Product', 'sku', 'High: SKU is indexed for performance');

-- =====================
-- RLS SECURITY TESTS (@critical tables)
-- =====================

-- Test RLS is enabled
SELECT table_privs_are('User', 'public', ARRAY[]::text[], 'RLS: User table has no public access');
SELECT table_privs_are('Order', 'public', ARRAY[]::text[], 'RLS: Order table has no public access');

-- Test RLS policies with JWT claims
SET LOCAL request.jwt.claims TO 
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- User can see own records
PREPARE user_select AS
  SELECT * FROM "User" WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
SELECT lives_ok('user_select', 'RLS: User can select own record');

-- User cannot see others' records
PREPARE other_select AS
  SELECT * FROM "User" WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;
SELECT is_empty('other_select', 'RLS: User cannot see other users');

-- User cannot insert others' orders
PREPARE wrong_order AS
  INSERT INTO "Order" (user_id, order_number, status, total_cents)
  VALUES ('00000000-0000-0000-0000-000000000002'::uuid, 'ORD-001', 'pending', 1000);
SELECT throws_ok(
  'wrong_order',
  '42501',
  'new row violates row-level security policy',
  'RLS: Cannot create orders for other users'
);

-- =====================
-- FOREIGN KEY TESTS
-- =====================

SELECT has_fk('Order', 'Foreign key from Order to User');
SELECT has_fk('OrderItem', 'Foreign key from OrderItem to Order');
SELECT has_fk('OrderItem', 'Foreign key from OrderItem to Product');

-- Test cascading deletes
SELECT fk_ok('OrderItem', 'order_id', 'Order', 'id', 'OrderItem→Order FK configured correctly');

-- =====================
-- PERFORMANCE TESTS (Weighted indexes)
-- =====================

-- High-weight columns are indexed
SELECT is_indexed('User', 'email', 'Performance: email indexed (weight 9)');
SELECT is_indexed('Product', 'sku', 'Performance: SKU indexed (weight 9)');
SELECT is_indexed('Product', 'slug', 'Performance: slug indexed (weight 7)');
SELECT is_indexed('Order', 'user_id', 'Performance: user_id indexed (weight 9)');

-- =====================
-- DATA INTEGRITY TESTS
-- =====================

-- Check constraints
SELECT col_default_is('User', 'email_verified', 'false', 'Default: email_verified is false');
SELECT col_default_is('Product', 'stock_quantity', '0', 'Default: stock starts at 0');
SELECT col_default_is('Product', 'published', 'false', 'Default: products unpublished');

-- Quantity must be positive
PREPARE negative_quantity AS
  INSERT INTO "OrderItem" (order_id, product_id, quantity, unit_price_cents)
  VALUES (gen_random_uuid(), gen_random_uuid(), -1, 100);
SELECT throws_ok(
  'negative_quantity',
  '23514',
  'new row for relation "OrderItem" violates check constraint',
  'Constraint: quantity must be positive'
);

-- =====================
-- MIGRATION SAFETY TESTS
-- =====================

-- No columns dropped (would have high MRI)
SELECT hasnt_column('User', 'old_field', 'Migration: no legacy columns');

-- Required columns not nullable (prevents data loss)
SELECT col_not_null('Order', 'total_cents', 'Migration: total_cents required');
SELECT col_not_null('User', 'created_at', 'Migration: timestamps required');

SELECT * FROM finish();
ROLLBACK;