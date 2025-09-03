-- ══════════════════════════════════════════════════════════════════
-- Wesley Generated pgTAP Test Suite
-- Generated: 2025-09-03T16:05:15.936Z
-- SHA: uncommitted
-- ══════════════════════════════════════════════════════════════════

-- Setup test environment
BEGIN;

-- Set deterministic environment
SET LOCAL timezone = 'UTC';
SET LOCAL statement_timeout = '5s';

-- Count tests for plan
SELECT plan(41);

-- ══════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- STRUCTURE TESTS
-- Testing tables, columns, and types
-- ══════════════════════════════════════════════════════

-- Table: User (weight: 3)
SELECT has_table('User', 'Table User should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:User.id -> no evidence map
SELECT has_column('User', 'id', 'Column User.id should exist');
SELECT col_type_is('User', 'id', 'uuid', 'User.id should be type uuid');
SELECT col_not_null('User', 'id', 'User.id should not be nullable');
SELECT col_is_pk('User', 'id', 'User.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: email
-- Weight: 40/100
-- Test Depth: STANDARD
-- Attributes: UNIQUE, NOT NULL
-- EVIDENCE: col:User.email -> no evidence map
SELECT has_column('User', 'email', 'Column User.email should exist');
SELECT col_type_is('User', 'email', 'text', 'User.email should be type text');
SELECT col_not_null('User', 'email', 'User.email should not be nullable');
SELECT col_is_unique('User', 'email', 'User.email should be unique');

-- Field: name
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:User.name -> no evidence map
SELECT has_column('User', 'name', 'Column User.name should exist');
SELECT col_type_is('User', 'name', 'text', 'User.name should be type text');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:User.created_at -> no evidence map
SELECT has_column('User', 'created_at', 'Column User.created_at should exist');
SELECT col_type_is('User', 'created_at', 'timestamptz', 'User.created_at should be type timestamptz');
SELECT col_not_null('User', 'created_at', 'User.created_at should not be nullable');

-- Table: Post (weight: 3)
SELECT has_table('Post', 'Table Post should exist');

-- Field: id
-- Weight: 55/100
-- Test Depth: COMPREHENSIVE
-- Attributes: PK, NOT NULL
-- EVIDENCE: col:Post.id -> no evidence map
SELECT has_column('Post', 'id', 'Column Post.id should exist');
SELECT col_type_is('Post', 'id', 'uuid', 'Post.id should be type uuid');
SELECT col_not_null('Post', 'id', 'Post.id should not be nullable');
SELECT col_is_pk('Post', 'id', 'Post.id should be primary key');
-- CRITICAL FIELD: Additional safety checks

-- Field: user_id
-- Weight: 45/100
-- Test Depth: STANDARD
-- Attributes: FK, NOT NULL
-- EVIDENCE: col:Post.user_id -> no evidence map
SELECT has_column('Post', 'user_id', 'Column Post.user_id should exist');
SELECT col_type_is('Post', 'user_id', 'uuid', 'Post.user_id should be type uuid');
SELECT col_not_null('Post', 'user_id', 'Post.user_id should not be nullable');
SELECT fk_ok('Post', 'user_id', 'User', 'id', 'Post.user_id references User');

-- Field: title
-- Weight: 15/100
-- Test Depth: MINIMAL
-- Attributes: NOT NULL
-- EVIDENCE: col:Post.title -> no evidence map
SELECT has_column('Post', 'title', 'Column Post.title should exist');
SELECT col_type_is('Post', 'title', 'text', 'Post.title should be type text');

-- Field: content
-- Weight: 0/100
-- Test Depth: MINIMAL
-- Attributes: STANDARD
-- EVIDENCE: col:Post.content -> no evidence map
SELECT has_column('Post', 'content', 'Column Post.content should exist');
SELECT col_type_is('Post', 'content', 'text', 'Post.content should be type text');

-- Field: created_at
-- Weight: 30/100
-- Test Depth: STANDARD
-- Attributes: NOT NULL
-- EVIDENCE: col:Post.created_at -> no evidence map
SELECT has_column('Post', 'created_at', 'Column Post.created_at should exist');
SELECT col_type_is('Post', 'created_at', 'timestamptz', 'Post.created_at should be type timestamptz');
SELECT col_not_null('Post', 'created_at', 'Post.created_at should not be nullable');


-- ══════════════════════════════════════════════════════
-- CONSTRAINT TESTS
-- Testing PK, FK, unique, check constraints
-- ══════════════════════════════════════════════════════

-- Constraints for User
SELECT col_is_pk('User', 'id', 'User.id should be primary key');
SELECT col_is_unique('User', 'email', 'User.email should be unique');
-- Email uniqueness should be case-insensitive
DO $$
BEGIN
  INSERT INTO "User" ("email") VALUES ('Test@Example.com');
  PERFORM throws_ok(
    $SQL$ INSERT INTO "User" ("email") VALUES ('test@example.com') $SQL$,
    '23505',
    'Should enforce case-insensitive email uniqueness'
  );
  ROLLBACK;
END $$;

-- Constraints for Post
SELECT col_is_pk('Post', 'id', 'Post.id should be primary key');
SELECT fk_ok(
  'Post', 'user_id',
  'User', 'id',
  'Post.user_id should reference User.id'
);
-- Test foreign key cascade behavior
DO $$
BEGIN
  -- Insert parent and child
  INSERT INTO "User" (id) VALUES ('test-parent-id');
  INSERT INTO "Post" ("user_id") VALUES ('test-parent-id');
  
  -- Test cascade (configure based on directive)
  -- This would be customized based on @onDelete directive
  ROLLBACK;
END $$;


-- ══════════════════════════════════════════════════════
-- DEFAULT VALUE TESTS
-- Testing default expressions
-- ══════════════════════════════════════════════════════

-- Test default for User.created_at
SELECT col_has_default('User', 'created_at', 'User.created_at should have default');
SELECT col_default_is(
  'User', 'created_at',
  'now()',
  'Default should be now()'
);

-- Test default for Post.created_at
SELECT col_has_default('Post', 'created_at', 'Post.created_at should have default');
SELECT col_default_is(
  'Post', 'created_at',
  'now()',
  'Default should be now()'
);


-- ══════════════════════════════════════════════════════
-- INDEX TESTS
-- Testing index existence and usage
-- ══════════════════════════════════════════════════════

-- Index test for User.email
SELECT has_index('User', 'User_email_idx', 'Index User_email_idx should exist');
-- Verify index is used in query plans
SELECT like(
  (SELECT json_agg(plan) FROM (
    EXPLAIN (FORMAT JSON) SELECT * FROM "User" WHERE "email" = 'test'
  ) AS t(plan))::text,
  '%Index Scan%',
  'Query on email should use index'
);


-- ══════════════════════════════════════════════════════
-- RLS TESTS (Supabase Row Level Security)
-- Testing access control policies
-- ══════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- Cleanup
SELECT * FROM finish();
ROLLBACK;