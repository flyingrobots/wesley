-- Failing → Passing pgTAP Test Example
-- Shows how Wesley's auto-generated tests catch issues

BEGIN;
SELECT plan(10);

-- ════════════════════════════════════════════════
-- INITIALLY FAILING TEST
-- ════════════════════════════════════════════════

-- Test 1: Table structure (WILL FAIL if table doesn't exist)
SELECT has_table('posts', 'Table posts should exist');

-- Test 2: Required columns (WILL FAIL if column missing)
SELECT has_column('posts', 'author_id', 'Should have author_id for ownership');

-- Test 3: RLS enabled (WILL FAIL if RLS not enabled)
SELECT table_has_rls('posts', 'RLS should be enabled on posts');

-- Test 4: Policy exists (WILL FAIL if policy missing)
SELECT policy_exists('posts', 'policy_posts_select_posts', 'Select policy should exist');

-- ════════════════════════════════════════════════
-- FIX: Run Wesley generation
-- ════════════════════════════════════════════════

-- After running: wesley generate --schema rpc-example.graphql
-- The following SQL would be generated:

/*
CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "author_id" uuid NOT NULL,
  "tags" text[] NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE NO ACTION,
  CHECK (NOT "tags" @> ARRAY[NULL]::text[])
);

ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_posts_select_posts" ON "posts"
  FOR SELECT USING (true);

CREATE POLICY "policy_posts_insert_posts" ON "posts"
  FOR INSERT WITH CHECK (auth.uid() = author_id);
*/

-- ════════════════════════════════════════════════
-- NOW PASSING TESTS
-- ════════════════════════════════════════════════

-- Test 5: Ownership protection (negative test)
SET LOCAL request.jwt.claims = '{"sub": "user-123", "role": "authenticated"}';
PREPARE insert_as_owner AS 
  INSERT INTO posts (title, author_id) VALUES ('My Post', 'user-123');
SELECT lives_ok('insert_as_owner', 'Owner can insert their own posts');

SET LOCAL request.jwt.claims = '{"sub": "user-456", "role": "authenticated"}';
PREPARE insert_as_other AS 
  INSERT INTO posts (title, author_id) VALUES ('Hack', 'user-123');
SELECT throws_ok('insert_as_other', 'Cannot insert as different user');

-- Test 6: Array nullability (itemNonNull)
PREPARE insert_null_tag AS 
  INSERT INTO posts (title, author_id, tags) 
  VALUES ('Test', 'user-123', ARRAY[NULL]::text[]);
SELECT throws_ok('insert_null_tag', 'Cannot insert NULL in tags array');

-- Test 7: RPC function exists and works
SELECT has_function('create_post', 'RPC function create_post should exist');

-- Test 8: RPC returns correct type
SELECT function_returns('create_post', 'posts', 'Should return posts type');

-- Test 9: Sensitive field protection
SELECT has_column('profiles', 'preferences', 'Preferences column exists');
-- In production, would test that PII field is properly protected

-- Test 10: Foreign key constraint
PREPARE insert_bad_fk AS 
  INSERT INTO posts (title, author_id) 
  VALUES ('Bad', 'non-existent-user');
SELECT throws_ok('insert_bad_fk', 'Foreign key constraint should prevent bad references');

SELECT * FROM finish();
ROLLBACK;

-- ════════════════════════════════════════════════
-- SUMMARY
-- ════════════════════════════════════════════════
-- This example shows how Wesley's generated tests:
-- 1. Catch missing tables/columns
-- 2. Verify RLS is properly configured
-- 3. Test ownership protection
-- 4. Validate array constraints (itemNonNull)
-- 5. Ensure RPC functions work correctly
-- 6. Protect sensitive/PII fields
-- 7. Enforce referential integrity
--
-- The auto-generated tests provide immediate feedback
-- on schema correctness and security configuration.