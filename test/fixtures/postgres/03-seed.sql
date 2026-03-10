-- Deterministic seed data for pgTAP smoke tests.
-- UUIDs use a fixed pattern so assertions are stable.

-- Products: Alpha (published, matches 'Al%'), Beta (unpublished)
INSERT INTO product (id, sku, name, slug, price_cents, stock_quantity, published, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000101'::uuid, 'SKU1', 'Alpha', 'alpha', 100, 10, true, now()),
  ('00000000-0000-0000-0000-000000000102'::uuid, 'SKU2', 'Beta',  'beta',  200,  0, false, now())
ON CONFLICT DO NOTHING;

-- User
INSERT INTO "user" (id, email, password_hash, full_name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'alice@example.com', 'hash_placeholder', 'Alice Test', now()
) ON CONFLICT DO NOTHING;

-- Order linked to user
INSERT INTO "order" (id, order_number, user_id, status, total_cents, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000201'::uuid,
  'ORD-001',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'confirmed', 300, now()
) ON CONFLICT DO NOTHING;

-- Order items (2 items in that order)
INSERT INTO orderitem (id, order_id, product_id, quantity, unit_price_cents)
VALUES
  ('00000000-0000-0000-0000-000000000301'::uuid,
   '00000000-0000-0000-0000-000000000201'::uuid,
   '00000000-0000-0000-0000-000000000101'::uuid,
   2, 100),
  ('00000000-0000-0000-0000-000000000302'::uuid,
   '00000000-0000-0000-0000-000000000201'::uuid,
   '00000000-0000-0000-0000-000000000102'::uuid,
   1, 200)
ON CONFLICT DO NOTHING;
