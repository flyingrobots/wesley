#!/usr/bin/env bats

# CLI Basic Tests - Core functionality converted to Bats format

# Load Bats plugins
load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'  
load 'bats-plugins/bats-file/load'

# Setup and helpers
setup() {
    # Create temp directory for this test
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    export TEST_TEMP_DIR
    cd "$TEST_TEMP_DIR"
    
    # Set CLI path to the proper location after ENSIGN reorganization
    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    export CLI_PATH
}

teardown() {
    # Clean up temp directory
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# Test helper functions
create_simple_schema() {
    cat > schema.graphql << 'EOF'
type Query {
  hello: String
}
EOF
}

create_invalid_schema() {
    cat > invalid.graphql << 'EOF'
type Query {
  hello: String
  # Missing closing brace
EOF
}

# Basic CLI functionality tests

@test "version flag works" {
    run node "$CLI_PATH" --version
    assert_success
    assert_output --partial "0.1.0"
}

@test "short version flag works" {
    run node "$CLI_PATH" -V
    assert_success
    assert_output --partial "0.1.0"
}

@test "help flag works" {
    run node "$CLI_PATH" --help
    assert_success
    assert_output --partial "Wesley - GraphQL → Everything"
}

@test "generate help works" {
    run node "$CLI_PATH" generate --help
    assert_success
    assert_output --partial "Generate SQL, tests, and more"
    assert_output --partial "stdin"
}

@test "missing schema file exits 2" {
    run node "$CLI_PATH" generate --schema ./nonexistent.graphql
    assert_failure 2
    assert_output --partial "Schema file not found"
    assert_output --partial "Try: wesley generate"
}

@test "GraphQL syntax error exits 3" {
    create_invalid_schema
    run node "$CLI_PATH" generate --schema invalid.graphql
    assert_failure 3
    assert_output --partial "PARSE_FAILED"
}

@test "quiet flag suppresses output" {
    run node "$CLI_PATH" generate --schema ./nonexistent.graphql --quiet
    assert_failure 2
    assert_output ""
}

@test "JSON mode formats errors as JSON" {
    run node "$CLI_PATH" generate --schema ./nonexistent.graphql --json
    assert_failure 2
    # Use jq to validate JSON structure
    echo "$output" | jq -e '.success == false'
    echo "$output" | jq -e '.code == "ENOENT"'
}

@test "stdin input with --schema - works" {
    run bash -c "echo 'type User @wes_table { id: ID! @wes_pk }' | node '$CLI_PATH' generate --schema - --out out"
    assert_success
    assert_file_exist out/schema.sql
}

@test "--stdin convenience flag works" {
    run bash -c "echo 'type User @wes_table { id: ID! @wes_pk }' | node '$CLI_PATH' generate --stdin --out out"
    assert_success
    assert_file_exist out/schema.sql
}

@test "empty stdin exits 2" {
    run bash -c "echo -n '' | node '$CLI_PATH' generate --schema -"
    assert_failure 2
    assert_output --partial "empty"
}

@test "JSON + stdin stream separation" {
    # Test that JSON output is properly structured
    run bash -c "echo -n '' | node '$CLI_PATH' generate --schema - --json"
    assert_failure 2
    # Validate JSON structure
    echo "$output" | jq -e '.success == false' >/dev/null
}
