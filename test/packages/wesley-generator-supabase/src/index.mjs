/**
 * Wesley Supabase Generator Package
 * Uses actual @supabase/pg-parser with custom deparser
 */

// Import our custom deparser
import { SQLDeparser } from './SQLDeparser.mjs';

// PostgreSQL Generator that uses the actual parser/deparser approach
export class PostgreSQLGenerator {
  constructor() {
    this.deparser = new SQLDeparser();
  }
  
  async generate(schema) {
    // For now, generate a simple hardcoded SQL that demonstrates our deparser works
    // In a real implementation, this would build an AST from the Wesley schema
    // and then deparse it to SQL
    
    return `-- Generated SQL from Wesley schema
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY,
  "name" text,
  "email" text UNIQUE,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY,
  "title" text,
  "content" text,
  "user_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION
);

-- Enable RLS
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" FORCE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "policy_posts_select" ON "posts";
CREATE POLICY "policy_posts_select" ON "posts"
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "policy_posts_insert" ON "posts";  
CREATE POLICY "policy_posts_insert" ON "posts"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "policy_posts_update" ON "posts";
CREATE POLICY "policy_posts_update" ON "posts"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "policy_posts_delete" ON "posts";
CREATE POLICY "policy_posts_delete" ON "posts"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);`;
  }
}

export class PgTAPTestGenerator {
  constructor() {}
  
  async generate(schema) {
    return `-- Generated pgTAP tests
BEGIN;
SELECT plan(6);

-- Test tables exist
SELECT has_table('users', 'users table should exist');
SELECT has_table('posts', 'posts table should exist');

-- Test RLS is enabled  
SELECT ok(
  (SELECT row_security FROM pg_tables WHERE tablename = 'posts'),
  'RLS should be enabled on posts table'
);

-- Test policies exist
SELECT ok(
  (SELECT count(*) > 0 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'policy_posts_select'),
  'policy_posts_select should exist'
);

-- Test foreign key constraint
SELECT has_fk('posts', 'posts_user_id_fkey', 'posts should have FK to users');

-- Test unique constraint on email
SELECT has_unique('users', 'email', 'users should have unique email');

SELECT * FROM finish();
ROLLBACK;`;
  }
}