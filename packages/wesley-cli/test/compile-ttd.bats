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
    MAIN_MODULE="$BATS_TEST_DIRNAME/../src/main.mjs"

    # Path to TTD test fixture
    TTD_SCHEMA="$BATS_TEST_DIRNAME/fixtures/basic-ttd-protocol.graphql"
    CONTINUUM_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
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

@test "legacy main surface delegates to the discovered compile-ttd command set" {
    create_minimal_ttd_schema
    run node --input-type=module <<EOF
import { main } from '${MAIN_MODULE}';
import { createNodeRuntime } from '${BATS_TEST_DIRNAME}/../../wesley-host-node/src/adapters/createNodeRuntime.mjs';

const runtime = await createNodeRuntime();
const processAdapter = {
  ...process,
  on() {},
  exit() {},
  stderr: { write(chunk) { process.stdout.write(String(chunk)); } }
};

const exitCode = await main(['node', 'wesley', 'compile-ttd', '--schema', 'ttd-schema.graphql', '--dry-run', '--json'], {
  ...runtime,
  process: processAdapter,
  logger: runtime.logger.child({ level: 100 })
});

console.log(JSON.stringify({ exitCode }));
EOF
    assert_success
    assert_output --partial '"schemaHash"'
    echo "$output" | jq -e '.exitCode == 0' >/dev/null
}

@test "legacy main surface honors injected process stderr for unknown commands" {
    run node --input-type=module <<EOF
import { main } from '${MAIN_MODULE}';

let capturedStderr = '';
const exitCode = await main(['node', 'wesley', 'definitely-not-a-command'], {
  process: {
    stdout: { write() {} },
    stderr: { write(chunk) { capturedStderr += String(chunk); } }
  }
});

console.log(JSON.stringify({ exitCode, capturedStderr }));
EOF
    assert_success
    echo "$output" | jq -e '.exitCode == 1' >/dev/null
    echo "$output" | jq -e '.capturedStderr | contains("unknown command")' >/dev/null
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
    jq -e '.generatedBy == "@wesley/core/ttd"' out/manifest/schema.json >/dev/null
    jq -e '.generated_by.tool == "@wesley/core/ttd"' out/manifest/ttd-ir.json >/dev/null
    refute grep -R "@wesley/generator-ttd" out
}

@test "compile-ttd generates typescript files" {
    create_minimal_ttd_schema
    run node "$CLI_PATH" compile-ttd --schema ttd-schema.graphql --out-dir out --target typescript
    assert_success
    assert_file_exist out/typescript/types.ts
    assert_file_exist out/typescript/zod.ts
    assert_file_exist out/typescript/registry.ts
    assert_file_exist out/typescript/index.ts
    assert_file_contains out/typescript/index.ts "@wesley/core/ttd"
    refute grep -R "@wesley/generator-ttd" out
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

@test "compile-ttd with continuum receipt family works" {
    run node "$CLI_PATH" compile-ttd --schema "$CONTINUUM_SCHEMA" --dry-run --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.schemaHash | length == 64' >/dev/null
    echo "$output" | jq -e '.result.files | map(.path) | index("manifest/manifest.json") != null' >/dev/null
    echo "$output" | jq -e '.result.files | map(.path) | index("typescript/types.ts") != null' >/dev/null
}

@test "compile-ttd and bundle-echo agree on authored schema hash" {
    run node "$CLI_PATH" compile-ttd --schema "$CONTINUUM_SCHEMA" --dry-run --json
    assert_success
    compile_hash="$(echo "$output" | jq -r '.result.schemaHash')"

    run node "$CLI_PATH" bundle-echo --schema "$CONTINUUM_SCHEMA" --out-dir out --json
    assert_success
    bundle_hash="$(echo "$output" | jq -r '.result.schemaHash')"

    assert_equal "$compile_hash" "$bundle_hash"
}
