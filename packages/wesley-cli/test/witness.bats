#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    TTD_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/ttd-protocol.graphql"
    ECHO_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/echo-core-types.graphql"
    RECEIPT_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
    SETTLEMENT_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-settlement-family.graphql"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "witness help works" {
    run node "$CLI_PATH" witness --help
    assert_success
    assert_output --partial "Verify generated contract legs against one shared Continuum witness scope"
    assert_output --partial "--schema"
    assert_output --partial "--target"
    assert_output --partial "--out-dir"
    assert_output --partial "--report-out"
}

@test "witness verifies a receipt-family output root compiled from one shared schema" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.kind == "wesley.continuum.conformance.v1"' >/dev/null
    echo "$output" | jq -e '.result.scope == "receipt-family"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/proof/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/proof/witness/conformance.json
}

@test "witness verifies current-minimum outputs from one root with per-leg schema overrides" {
    node "$CLI_PATH" compile-ttd --schema "$TTD_SCHEMA" --out-dir out/current/warp-ttd >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir out/current/echo >/dev/null

    run node "$CLI_PATH" witness \
        --scope current-minimum-shared-surface \
        --ttd-schema "$TTD_SCHEMA" \
        --echo-schema "$ECHO_SCHEMA" \
        --out-dir out/current \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.scope == "current-minimum-shared-surface"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/current/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/current/witness/conformance.json
}

@test "witness verifies a settlement-family output root compiled from one shared schema" {
    node "$CLI_PATH" compile --schema "$SETTLEMENT_SCHEMA" --target warp-ttd,echo --out-dir out/settlement >/dev/null

    run node "$CLI_PATH" witness \
        --scope settlement-family \
        --schema "$SETTLEMENT_SCHEMA" \
        --out-dir out/settlement \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.scope == "settlement-family"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/settlement/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/settlement/witness/conformance.json
}

@test "witness rejects incomplete target sets for cross-leg conformance" {
    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --target warp-ttd \
        --out-dir out/proof
    assert_failure
    assert_output --partial 'requires both generated legs: warp-ttd, echo'
}
