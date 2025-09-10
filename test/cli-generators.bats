#!/usr/bin/env bats

# CLI Generator Tests - Test TypeScript and Zod generation commands

load 'helpers'

setup() {
    export CLI_PATH="$BATS_TEST_DIRNAME/../packages/wesley-cli/wesley.mjs"
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

@test "typescript command shows help" {
    run node "$CLI_PATH" typescript --help
    assert_success
    assert_output --partial "Generate TypeScript interfaces"
    assert_output --partial "--schema <path>"
    assert_output --partial "--out-file <file>"
}

@test "zod command shows help" {
    run node "$CLI_PATH" zod --help
    assert_success
    assert_output --partial "Generate standalone Zod validation schemas"
    assert_output --partial "--schema <path>"
    assert_output --partial "--out-file <file>"
}

@test "typescript command generates interfaces to stdout" {
    run node "$CLI_PATH" typescript --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "export interface User"
    assert_output --partial "export interface Post" 
    assert_output --partial "export interface UserCreate"
    assert_output --partial "export interface UserUpdate"
    assert_output --partial "id: string;"
    assert_output --partial "name: string;"
    assert_output --partial "content?: string | null;"
}

@test "typescript command writes to file" {
    local output_file="$TEMP_DIR/types.ts"
    
    run node "$CLI_PATH" typescript --schema "$TEST_SCHEMA" --out-file "$output_file" --quiet
    assert_success
    
    assert_file_exists "$output_file"
    assert_file_contains "$output_file" "export interface User"
    assert_file_contains "$output_file" "export interface Post"
    assert_file_contains "$output_file" "id: string;"
}

@test "zod command generates schemas to stdout" {
    run node "$CLI_PATH" zod --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "import { z } from 'zod';"
    assert_output --partial "export const UserSchema = z.object"
    assert_output --partial "export const PostSchema = z.object"
    assert_output --partial "export type User = z.infer<typeof UserSchema>;"
    assert_output --partial "id: z.string().uuid()"
    assert_output --partial "name: z.string()"
    assert_output --partial "created_at: z.string().datetime()"
}

@test "zod command writes to file" {
    local output_file="$TEMP_DIR/zod.ts"
    
    run node "$CLI_PATH" zod --schema "$TEST_SCHEMA" --out-file "$output_file" --quiet
    assert_success
    
    assert_file_exists "$output_file"
    assert_file_contains "$output_file" "export const UserSchema"
    assert_file_contains "$output_file" "export const PostSchema"
    assert_file_contains "$output_file" "import { z } from 'zod';"
}

@test "typescript command handles foreign keys correctly" {
    run node "$CLI_PATH" typescript --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "user_id: string;"
}

@test "zod command handles foreign keys correctly" {
    run node "$CLI_PATH" zod --schema "$TEST_SCHEMA" --quiet 
    assert_success
    assert_output --partial "user_id: z.string().uuid()"
}

@test "zod command generates create/update schemas" {
    run node "$CLI_PATH" zod --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "export const UserCreateSchema"
    assert_output --partial "export const UserUpdateSchema" 
    assert_output --partial "export type UserCreate"
    assert_output --partial "export type UserUpdate"
}

@test "typescript command handles optional fields" {
    run node "$CLI_PATH" typescript --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "content?: string | null;"
}

@test "zod command handles optional fields" {
    run node "$CLI_PATH" zod --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "content: z.string().optional()"
}

@test "commands handle nonexistent schema file" {
    run node "$CLI_PATH" typescript --schema /nonexistent/file.graphql 2>/dev/null
    assert_failure 2
    assert_output --partial "Schema file not found"
    
    run node "$CLI_PATH" zod --schema /nonexistent/file.graphql 2>/dev/null
    assert_failure 2
    assert_output --partial "Schema file not found"
}

@test "commands handle stdin input" {
    run bash -c "cat '$TEST_SCHEMA' | node '$CLI_PATH' typescript --schema - --quiet"
    assert_success
    assert_output --partial "export interface User"
    
    run bash -c "cat '$TEST_SCHEMA' | node '$CLI_PATH' zod --schema - --quiet"
    assert_success
    assert_output --partial "export const UserSchema"
}

@test "typescript alias works" {
    run node "$CLI_PATH" ts --schema "$TEST_SCHEMA" --quiet
    assert_success
    assert_output --partial "export interface User"
}