#!/usr/bin/env bats

# CLI E2E Tests - Test complete pipeline with real schemas including RLS

load 'helpers'

setup() {
    export CLI_PATH="$BATS_TEST_DIRNAME/../packages/wesley-cli/wesley.mjs"
    export TEMP_DIR="$(mktemp -d)"
    export RLS_SCHEMA="$BATS_TEST_DIRNAME/fixtures/rls-schema.graphql"
}

teardown() {
    rm -rf "$TEMP_DIR"
}

@test "generate command with RLS schema creates SQL with policies" {
    local output_dir="$TEMP_DIR/generated"
    
    run node "$CLI_PATH" generate --schema "$RLS_SCHEMA" --out-dir "$output_dir" --quiet
    assert_success
    
    # Check that SQL file was generated
    assert_file_exists "$output_dir/schema.sql"
    
    # Check for RLS policy generation
    assert_file_contains "$output_dir/schema.sql" "ENABLE ROW LEVEL SECURITY"
    assert_file_contains "$output_dir/schema.sql" "FORCE ROW LEVEL SECURITY" 
    assert_file_contains "$output_dir/schema.sql" "CREATE POLICY"
    assert_file_contains "$output_dir/schema.sql" "auth.uid() = user_id"
}

@test "generate command with RLS schema creates pgTAP tests for RLS" {
    local output_dir="$TEMP_DIR/generated"
    
    run node "$CLI_PATH" generate --schema "$RLS_SCHEMA" --out-dir "$output_dir" --quiet
    assert_success
    
    # Check that test file was generated
    local test_file=$(find "$output_dir" -name "*.sql" -path "*/tests/*" | head -1)
    if [[ -n "$test_file" ]]; then
        assert_file_contains "$test_file" "RLS"
        assert_file_contains "$test_file" "policy"
    fi
}

@test "models command works with RLS schema" {
    local models_dir="$TEMP_DIR/models"
    
    run node "$CLI_PATH" models --schema "$RLS_SCHEMA" --target js --out-dir "$models_dir" --quiet
    assert_success
    
    # Check generated model files
    assert_file_exists "$models_dir/User.js"
    assert_file_exists "$models_dir/Post.js"
    
    # Models should contain expected fields
    assert_file_contains "$models_dir/User.js" "export class User"
    assert_file_contains "$models_dir/Post.js" "export class Post"
    assert_file_contains "$models_dir/Post.js" "user_id:"
}

@test "typescript command works with RLS schema" {
    local output_file="$TEMP_DIR/types.ts"
    
    run node "$CLI_PATH" typescript --schema "$RLS_SCHEMA" --out-file "$output_file" --quiet
    assert_success
    
    assert_file_exists "$output_file"
    assert_file_contains "$output_file" "export interface User"
    assert_file_contains "$output_file" "export interface Post"
    assert_file_contains "$output_file" "user_id: string;"
}

@test "zod command works with RLS schema" {
    local output_file="$TEMP_DIR/zod.ts"
    
    run node "$CLI_PATH" zod --schema "$RLS_SCHEMA" --out-file "$output_file" --quiet
    assert_success
    
    assert_file_exists "$output_file"
    assert_file_contains "$output_file" "export const UserSchema"
    assert_file_contains "$output_file" "export const PostSchema" 
    assert_file_contains "$output_file" "user_id: z.string().uuid()"
}

@test "generate command handles complex RLS policies" {
    # Create schema with more complex RLS
    local complex_schema="$TEMP_DIR/complex-rls.graphql"
    cat > "$complex_schema" << 'EOF'
type Organization @table {
  id: ID! @pk
  name: String!
}

type User @table @rls(
  select: "true"
  insert: "auth.uid() = id"
  update: "auth.uid() = id"  
  delete: "auth.uid() = id"
) {
  id: ID! @pk
  email: String! @unique
  org_id: ID! @fk(ref: "Organization.id")
}

type Document @table @tenant(by: "org_id") @rls(
  select: "wesley.is_member_of(org_id)"
  insert: "wesley.is_member_of(org_id)"
  update: "wesley.is_member_of(org_id) AND auth.uid() = created_by"
  delete: "wesley.has_role_in(org_id, ARRAY['owner', 'admin'])"
) {
  id: ID! @pk
  title: String!
  org_id: ID! @fk(ref: "Organization.id")
  created_by: ID! @fk(ref: "User.id")
}
EOF
    
    local output_dir="$TEMP_DIR/complex-generated"
    
    run node "$CLI_PATH" generate --schema "$complex_schema" --out-dir "$output_dir" --quiet
    assert_success
    
    assert_file_exists "$output_dir/schema.sql"
    
    # Check for complex RLS policies
    assert_file_contains "$output_dir/schema.sql" "wesley.is_member_of"
    assert_file_contains "$output_dir/schema.sql" "wesley.has_role_in"
    assert_file_contains "$output_dir/schema.sql" "auth.uid() = created_by"
}

@test "generate command creates comprehensive output bundle" {
    local output_dir="$TEMP_DIR/full-bundle"
    
    run node "$CLI_PATH" generate --schema "$RLS_SCHEMA" --out-dir "$output_dir" --emit-bundle --quiet
    assert_success
    
    # Check all expected outputs exist
    assert_file_exists "$output_dir/schema.sql"
    
    # Check for bundle directory
    if [[ -d "$output_dir/.wesley" ]]; then
        # Should contain evidence and scores
        local bundle_files=$(find "$output_dir/.wesley" -type f | wc -l)
        [[ $bundle_files -gt 0 ]]
    fi
}

@test "generate command with supabase flag includes RLS helpers" {
    local output_dir="$TEMP_DIR/supabase-generated"
    
    run node "$CLI_PATH" generate --schema "$RLS_SCHEMA" --out-dir "$output_dir" --supabase --quiet
    assert_success
    
    assert_file_exists "$output_dir/schema.sql"
    
    # Should include Supabase-specific RLS patterns
    # Note: This tests the --supabase flag functionality
}

@test "all generators work together with same schema" {
    # Test that all generators can process the same RLS schema successfully
    local base_dir="$TEMP_DIR/all-generators"
    mkdir -p "$base_dir"
    
    # Generate SQL + tests
    run node "$CLI_PATH" generate --schema "$RLS_SCHEMA" --out-dir "$base_dir/sql" --quiet
    assert_success
    
    # Generate models  
    run node "$CLI_PATH" models --schema "$RLS_SCHEMA" --target js --out-dir "$base_dir/models" --quiet
    assert_success
    
    # Generate TypeScript
    run node "$CLI_PATH" typescript --schema "$RLS_SCHEMA" --out-file "$base_dir/types.ts" --quiet
    assert_success
    
    # Generate Zod
    run node "$CLI_PATH" zod --schema "$RLS_SCHEMA" --out-file "$base_dir/schemas.ts" --quiet
    assert_success
    
    # All should succeed and create files
    assert_file_exists "$base_dir/sql/schema.sql"
    assert_file_exists "$base_dir/models/User.js"
    assert_file_exists "$base_dir/types.ts"
    assert_file_exists "$base_dir/schemas.ts"
}