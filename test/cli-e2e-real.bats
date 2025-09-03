#!/usr/bin/env bats

# Real E2E Tests: GraphQL Schema In → Generated Artifacts Out
# Tests the actual user workflow, not implementation details

load "helpers.bash"

setup() {
    # Set up paths
    CLI_PATH="$(pwd)/../packages/wesley-cli/wesley.mjs"
    output_dir="$(mktemp -d)"
    
    # Simple test schema
    cat > "$BATS_TMPDIR/test-schema.graphql" << 'EOF'
type User @table {
  id: ID! @pk
  email: String! @unique
  name: String!
  created_at: DateTime! @default(value: "now()")
}

type Post @table {
  id: ID! @pk
  title: String!
  content: String
  user_id: ID! @fk(ref: "User.id")
  created_at: DateTime! @default(value: "now()")
}
EOF
}

teardown() {
    # Clean up temp directory
    if [[ -n "$output_dir" && -d "$output_dir" ]]; then
        rm -rf "$output_dir"
    fi
}

@test "models command generates working JavaScript classes" {
    # Execute: Generate JS models
    run node "$CLI_PATH" models --schema "$BATS_TMPDIR/test-schema.graphql" --target js --out-dir "$output_dir" --quiet
    assert_success
    
    # Verify: Generated files exist
    assert_file_exists "$output_dir/User.js"
    assert_file_exists "$output_dir/Post.js"
    
    # Verify: JS files are syntactically valid
    run node -c "$output_dir/User.js"
    assert_success
    
    run node -c "$output_dir/Post.js"
    assert_success
    
    # Verify: Generated code contains expected exports
    run grep -q "export.*User" "$output_dir/User.js"
    assert_success
    
    run grep -q "export.*Post" "$output_dir/Post.js"
    assert_success
    
    # Verify: Zod validation schemas are present
    run grep -q "z\." "$output_dir/User.js"
    assert_success
}

@test "models command generates working TypeScript classes" {
    # Execute: Generate TS models
    run node "$CLI_PATH" models --schema "$BATS_TMPDIR/test-schema.graphql" --target ts --out-dir "$output_dir" --quiet
    assert_success
    
    # Verify: Generated files exist
    assert_file_exists "$output_dir/User.ts"
    assert_file_exists "$output_dir/Post.ts"
    
    # Verify: TS files contain proper exports
    run grep -q "export class User" "$output_dir/User.ts"
    assert_success
    
    run grep -q "export class Post" "$output_dir/Post.ts"
    assert_success
    
    # Verify: Foreign key relationships work
    run grep -q "user_id.*string" "$output_dir/Post.ts"
    assert_success
}

@test "zod command generates working Zod schemas" {
    # Execute: Generate Zod schemas
    run node "$CLI_PATH" zod --schema "$BATS_TMPDIR/test-schema.graphql" --out-file "$output_dir/schemas.js" --quiet
    assert_success
    
    # Verify: Output file exists
    assert_file_exists "$output_dir/schemas.js"
    
    # Verify: File is syntactically valid JavaScript
    run node -c "$output_dir/schemas.js"
    assert_success
    
    # Verify: Contains Zod imports and schemas
    run grep -q "import.*zod" "$output_dir/schemas.js"
    assert_success
    
    run grep -q "UserSchema" "$output_dir/schemas.js"
    assert_success
    
    run grep -q "PostSchema" "$output_dir/schemas.js"
    assert_success
}

@test "typescript command generates working TypeScript types" {
    # Execute: Generate TS types
    run node "$CLI_PATH" typescript --schema "$BATS_TMPDIR/test-schema.graphql" --out-file "$output_dir/types.ts" --quiet
    assert_success
    
    # Verify: Output file exists
    assert_file_exists "$output_dir/types.ts"
    
    # Verify: Contains type definitions
    run grep -q "interface User" "$output_dir/types.ts"
    assert_success
    
    run grep -q "interface Post" "$output_dir/types.ts"
    assert_success
    
    # Verify: Types have correct fields
    run grep -q "id.*string" "$output_dir/types.ts"
    assert_success
    
    run grep -q "email.*string" "$output_dir/types.ts"
    assert_success
}

@test "generate command produces all artifacts" {
    # Execute: Full generation pipeline
    run node "$CLI_PATH" generate --schema "$BATS_TMPDIR/test-schema.graphql" --quiet
    assert_success
    
    # Verify: SQL DDL is generated
    assert_file_exists "out/schema.sql"
    
    # Verify: SQL contains table definitions
    run grep -q "CREATE TABLE.*User" "out/schema.sql"
    assert_success
    
    run grep -q "CREATE TABLE.*Post" "out/schema.sql"
    assert_success
    
    # Verify: SQL contains constraints
    run grep -q "PRIMARY KEY" "out/schema.sql"
    assert_success
    
    run grep -q "UNIQUE" "out/schema.sql"
    assert_success
    
    run grep -q "FOREIGN KEY" "out/schema.sql"
    assert_success
}

@test "stdin input works for all commands" {
    # Test: models command with stdin
    run bash -c "echo 'type User @table { id: ID! @pk }' | node '$CLI_PATH' models --schema - --target js --out-dir '$output_dir' --quiet"
    assert_success
    assert_file_exists "$output_dir/User.js"
    
    # Test: zod command with stdin  
    run bash -c "echo 'type User @table { id: ID! @pk }' | node '$CLI_PATH' zod --schema - --out-file '$output_dir/zod.js' --quiet"
    assert_success
    assert_file_exists "$output_dir/zod.js"
}

@test "error handling works properly" {
    # Test: Invalid GraphQL syntax
    echo "invalid graphql syntax here" > "$BATS_TMPDIR/bad-schema.graphql"
    
    run node "$CLI_PATH" models --schema "$BATS_TMPDIR/bad-schema.graphql" --target js --out-dir "$output_dir" --quiet
    assert_failure
    
    # Test: Missing schema file
    run node "$CLI_PATH" models --schema "$BATS_TMPDIR/nonexistent.graphql" --target js --out-dir "$output_dir" --quiet
    assert_failure
}

@test "aliases work correctly" {
    # Test: typescript alias 'ts' works
    run node "$CLI_PATH" ts --schema "$BATS_TMPDIR/test-schema.graphql" --out-file "$output_dir/types.ts" --quiet
    assert_success
    assert_file_exists "$output_dir/types.ts"
}