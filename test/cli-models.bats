#!/usr/bin/env bats

# CLI Models Command Tests - Test model generation functionality

load 'helpers'

setup() {
    # Use host-node entrypoint (CLI package wrapper file no longer exists)
    export CLI_PATH="$BATS_TEST_DIRNAME/../packages/wesley-host-node/bin/wesley.mjs"
    export TEMP_DIR="$(mktemp -d)"
    export TEST_SCHEMA="$TEMP_DIR/test-schema.graphql"
    
    # Create test schema
    cat > "$TEST_SCHEMA" << 'EOF'
type User @table {
  id: ID! @pk
  name: String!
  email: String! @unique
  created_at: DateTime! @default(value: "now()")
}

type Post @table {
  id: ID! @pk  
  title: String!
  content: String
  user_id: ID! @fk(ref: "User.id")
}
EOF
}

teardown() {
    rm -rf "$TEMP_DIR"
}

@test "models command shows help" {
    run node "$CLI_PATH" models --help
    assert_success
    assert_output --partial "Generate TypeScript/JavaScript model classes"
    assert_output --partial "--target <type>"
    assert_output --partial "--schema <path>"
}

@test "models command requires --schema flag" {
    run node "$CLI_PATH" models --target js 2>/dev/null
    assert_failure
    assert_output --partial "required option '--schema <path>' not specified"
}

@test "models command with nonexistent schema file fails" {
    run node "$CLI_PATH" models --schema /nonexistent/file.graphql --target js 2>/dev/null
    assert_failure 2
    assert_output --partial "Schema file not found"
}

@test "models command with JavaScript target generates JS files" {
    local output_dir="$TEMP_DIR/js-models"
    
    run node "$CLI_PATH" models --schema "$TEST_SCHEMA" --target js --out-dir "$output_dir" --quiet
    assert_success
    
    # Check generated files exist
    assert_file_exists "$output_dir/User.js"
    assert_file_exists "$output_dir/User.d.ts"
    assert_file_exists "$output_dir/Post.js"
    assert_file_exists "$output_dir/Post.d.ts"
    assert_file_exists "$output_dir/index.js" 
    assert_file_exists "$output_dir/index.d.ts"
    
    # Check User.js contains expected content
    assert_file_contains "$output_dir/User.js" "export class User"
    assert_file_contains "$output_dir/User.js" "import { z } from \"zod\""
    assert_file_contains "$output_dir/User.js" "static from(data)"
    assert_file_contains "$output_dir/User.js" "static safeFrom(data)"
    assert_file_contains "$output_dir/User.js" "toJSON()"
    assert_file_contains "$output_dir/User.js" "clone()"
}

@test "models command with TypeScript target generates TS files" {
    local output_dir="$TEMP_DIR/ts-models"
    
    run node "$CLI_PATH" models --schema "$TEST_SCHEMA" --target ts --out-dir "$output_dir" --quiet
    assert_success
    
    # Check generated files exist  
    assert_file_exists "$output_dir/User.ts"
    assert_file_exists "$output_dir/Post.ts"
    assert_file_exists "$output_dir/index.ts"
    
    # Check User.ts contains expected content
    assert_file_contains "$output_dir/User.ts" "export class User"
    assert_file_contains "$output_dir/User.ts" "export type UserType"
    assert_file_contains "$output_dir/User.ts" "static from(data: unknown): User"
    assert_file_contains "$output_dir/User.ts" "toJSON(): Record<string, any>"
}

@test "models command handles stdin input" {
    local output_dir="$TEMP_DIR/stdin-models"
    
    run bash -c "cat '$TEST_SCHEMA' | node '$CLI_PATH' models --schema - --target js --out-dir '$output_dir' --quiet"
    assert_success
    
    assert_file_exists "$output_dir/User.js"
    assert_file_exists "$output_dir/Post.js"
}

@test "models command validates schema syntax" {
    local bad_schema="$TEMP_DIR/bad-schema.graphql"
    echo "type User {" > "$bad_schema"  # Invalid - missing closing brace
    
    run node "$CLI_PATH" models --schema "$bad_schema" --target js 2>/dev/null
    assert_failure
    assert_output --partial "GraphQL syntax error"
}

@test "models command handles foreign key references correctly" {
    local output_dir="$TEMP_DIR/fk-models"
    
    run node "$CLI_PATH" models --schema "$TEST_SCHEMA" --target js --out-dir "$output_dir" --quiet
    assert_success
    
    # Check that Post model has user_id field
    assert_file_contains "$output_dir/Post.js" "user_id:"
    assert_file_contains "$output_dir/Post.js" "this.user_id"
}

@test "models command handles default values correctly" {
    local output_dir="$TEMP_DIR/default-models"
    
    run node "$CLI_PATH" models --schema "$TEST_SCHEMA" --target js --out-dir "$output_dir" --quiet
    assert_success
    
    # Check that User model has created_at with default
    assert_file_contains "$output_dir/User.js" "created_at:"
    assert_file_contains "$output_dir/User.js" ".default(() => new Date())"
}

@test "models command generates valid Zod schemas" {
    local output_dir="$TEMP_DIR/zod-models"
    
    run node "$CLI_PATH" models --schema "$TEST_SCHEMA" --target js --out-dir "$output_dir" --quiet  
    assert_success
    
    # Check Zod schema structure
    assert_file_contains "$output_dir/User.js" "const UserSchema = z.object({"
    assert_file_contains "$output_dir/User.js" "id: z.string()"
    assert_file_contains "$output_dir/User.js" "email: z.string()"
    assert_file_contains "$output_dir/User.js" "created_at: z.date().default"
}

@test "package exports work correctly" {
    # Test that we can import from @wesley/host-node (run from packages directory)
    cd packages/wesley-cli
    run node -e "
    const imports = await import('@wesley/host-node');
    const requiredExports = ['GraphQLAdapter', 'ModelGenerator', 'GraphQLSchemaParser'];
    const missing = requiredExports.filter(exp => !imports[exp]);
    if (missing.length > 0) {
      console.error('Missing exports:', missing);
      process.exit(1);
    }
    console.log('All required exports present');
    "
    assert_success
    assert_output "All required exports present"
}
