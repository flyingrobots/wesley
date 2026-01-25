#!/usr/bin/env bats

# CLI compile-ttd command tests

# Load Bats plugins
load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

# Setup and helpers
setup() {
    # Create temp directory for this test
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    # Set CLI path
    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"

    # Path to TTD test fixture
    TTD_SCHEMA="$BATS_TEST_DIRNAME/../../wesley-generator-ttd/test/fixtures/basic-protocol.graphql"
}

teardown() {
    # Clean up temp directory
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# Create a minimal TTD schema for testing
create_minimal_ttd_schema() {
    cat > ttd-schema.graphql << 'EOF'
enum Status { PENDING ACTIVE COMPLETED }

type Item @wes_version(major: 1, minor: 0) @wes_registry(id: 1) {
  id: ID!
  status: Status!
}

type Mutation {
  createItem(name: String!): Item!
    @wes_op(name: "createItem")
    @wes_rule(name: "init", from: ["PENDING"], to: "ACTIVE")
}
EOF
}

@test "compile-ttd help works" {
    run node "$CLI_PATH" compile-ttd --help
    assert_success
    assert_output --partial "Compile GraphQL schema with TTD directives"
    assert_output --partial "--out-dir"
    assert_output --partial "--target"
    assert_output --partial "--dry-run"
}

@test "compile-ttd dry-run shows files" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --dry-run
    assert_success
    assert_output --partial "Would generate"
    assert_output --partial "manifest/schema.json"
    assert_output --partial "typescript/types.ts"
}

@test "compile-ttd generates manifest files" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --out-dir out --target manifest
    assert_success
    assert_file_exist out/manifest/schema.json
    assert_file_exist out/manifest/contracts.json
    assert_file_exist out/manifest/manifest.json
    assert_file_exist out/manifest/ttd-ir.json
}

@test "compile-ttd generates typescript files" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --out-dir out --target typescript
    assert_success
    assert_file_exist out/typescript/types.ts
    assert_file_exist out/typescript/zod.ts
    assert_file_exist out/typescript/registry.ts
    assert_file_exist out/typescript/index.ts
}

@test "compile-ttd generates both targets by default" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --out-dir out
    assert_success
    assert_file_exist out/manifest/schema.json
    assert_file_exist out/typescript/types.ts
}

@test "compile-ttd JSON output includes schema hash" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --dry-run --json
    assert_success
    echo "$output" | jq -e '.success == true'
    echo "$output" | jq -e '.result.schemaHash | length == 64'
}

@test "compile-ttd stdin input works" {
    create_minimal_ttd_schema
    run bash -c "cat ttd-schema.graphql | node '$CLI_PATH' compile-ttd --schema - --dry-run --json"
    assert_success
    echo "$output" | jq -e '.success == true'
}

@test "compile-ttd invalid target exits with error" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --target invalid
    assert_failure
    assert_output --partial "Invalid target"
}

@test "compile-ttd missing schema exits 2" {
    run node "$CLI_PATH" compile-ttd --schema nonexistent.graphql
    assert_failure 2
    assert_output --partial "Schema file not found"
}

@test "compile-ttd with basic-protocol fixture works" {
    run node "$CLI_PATH" compile-ttd --schema "$TTD_SCHEMA" --dry-run --json
    assert_success
    echo "$output" | jq -e '.result.files | length > 0'
}
