#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    ECHO_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/echo-core-types.graphql"
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

    run bash -lc "grep -c '\"envelope\":\"DeliveryObservationSummary\"' out/mock/deliveries.jsonl"
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
