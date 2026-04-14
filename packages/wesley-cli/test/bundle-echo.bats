#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    BUNDLE_ECHO_MODULE="$BATS_TEST_DIRNAME/../src/commands/bundle-echo.mjs"
    ECHO_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/echo-core-types.graphql"
    CONTINUUM_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "bundle-echo help works" {
    run node "$CLI_PATH" bundle-echo --help
    assert_success
    assert_output --partial "Generate Echo bundle artifacts"
    assert_output --partial "--out-dir"
    assert_output --partial "--warpspace"
    assert_output --partial "--dry-run"
}

@test "bundle-echo writes echo bundle and mocked deliveries summary" {
    run node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir out --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.echo.artifactCount >= 6' >/dev/null
    echo "$output" | jq -e '.result.mock.command == "deliveries"' >/dev/null
    echo "$output" | jq -e '.result.mock.observationCount == 4' >/dev/null

    assert_file_exist out/ir.json
    assert_file_exist out/ops.generated.ts
    assert_file_exist out/schemas.generated.ts
    assert_file_exist out/client.generated.ts
    assert_file_exist out/raw_le_codec.generated.ts
    assert_file_exist out/raw_le_codec.generated.rs
    assert_file_exist out/wasm_abi_codec.generated.ts
    assert_file_exist out/wasm_abi_codec.generated.rs
    assert_file_exist out/mock/deliveries.jsonl
    assert_file_exist out/mock/summary.json

    run grep -c '"envelope":"DeliveryObservationSummary"' out/mock/deliveries.jsonl
    assert_success
    assert_output "4"

    run jq -e '.mock.command == "deliveries" and .mock.observationCount == 4' out/mock/summary.json
    assert_success
}

@test "bundle-echo dry-run does not write files" {
    run node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir out --dry-run --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.dryRun == true' >/dev/null
    assert_file_not_exist out/ir.json
    assert_file_not_exist out/mock/deliveries.jsonl
}

@test "bundle-echo normalizes slash-heavy output paths" {
    run node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir "out///echo///" --json
    assert_success
    echo "$output" | jq -e '.result.outDir == "out///echo///"' >/dev/null
    echo "$output" | jq -e '.result.mock.outputPath == "out/echo/mock/deliveries.jsonl"' >/dev/null
    echo "$output" | jq -e '.result.mock.summaryPath == "out/echo/mock/summary.json"' >/dev/null

    assert_file_exist out/echo/ir.json
    assert_file_exist out/echo/mock/deliveries.jsonl
}

@test "bundle-echo readIr surfaces malformed JSON clearly" {
    run node --input-type=module - <<EOF
import { readIr } from '${BUNDLE_ECHO_MODULE}';

try {
  readIr([{ path: 'ir.json', content: '{' }]);
  console.error('expected readIr to fail');
  process.exit(1);
} catch (error) {
  console.log(JSON.stringify({
    code: error.code,
    message: error.message
  }));
}
EOF
    assert_success
    echo "$output" | jq -e '.code == "ECHO_GENERATION_FAILED"' >/dev/null
    echo "$output" | jq -e '.message | contains("malformed ir.json")' >/dev/null
}

@test "bundle-echo fallback detector only accepts missing-module import failures" {
    run node --input-type=module - <<EOF
import { shouldFallbackGenerateEchoImport } from '${BUNDLE_ECHO_MODULE}';

const missing = Object.assign(new Error("Cannot find package '@wesley/generator-echo' imported from /tmp/test.mjs"), {
  code: 'ERR_MODULE_NOT_FOUND'
});
const syntax = new SyntaxError('Unexpected token');

console.log(JSON.stringify({
  missing: shouldFallbackGenerateEchoImport(missing),
  syntax: shouldFallbackGenerateEchoImport(syntax)
}));
EOF
    assert_success
    echo "$output" | jq -e '.missing == true and .syntax == false' >/dev/null
}

@test "bundle-echo with continuum receipt family works" {
    run node "$CLI_PATH" bundle-echo --schema "$CONTINUUM_SCHEMA" --out-dir out --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.echo.artifactCount >= 6' >/dev/null
    echo "$output" | jq -e '.result.echo.ir.opCount == 4' >/dev/null
    echo "$output" | jq -e '.result.mock.command == "deliveries"' >/dev/null

    assert_file_exist out/ir.json
    assert_file_exist out/mock/deliveries.jsonl
    assert_file_exist out/mock/summary.json
}

@test "bundle-echo resolves its output root from warpspace.mjs" {
    cat > warpspace.mjs <<'EOF'
export default {
  kind: 'wesley.warpspace.v1',
  outputs: {
    'echo-ir': 'crates/my-app-contracts/src/generated/echo'
  }
};
EOF

    run node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --json
    assert_success
    echo "$output" | jq -e '.success == true and (.result.outDir | endswith("crates/my-app-contracts/src/generated/echo"))' >/dev/null
    assert_file_exist crates/my-app-contracts/src/generated/echo/ir.json
    assert_file_exist crates/my-app-contracts/src/generated/echo/mock/summary.json
}
