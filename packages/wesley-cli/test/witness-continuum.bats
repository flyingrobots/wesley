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
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

generate_local_inspect_surfaces() {
    node "$CLI_PATH" compile-ttd --schema "$TTD_SCHEMA" --out-dir out/ttd >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir out/echo >/dev/null
}

@test "witness-continuum help works" {
    run node "$CLI_PATH" witness-continuum --help
    assert_success
    assert_output --partial "Verify current Continuum minimum-surface coherence"
    assert_output --partial "--ttd-schema"
    assert_output --partial "--echo-dir"
}

@test "witness-continuum writes a passing conformance report" {
    generate_local_inspect_surfaces

    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir out/ttd \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir out/echo \
        --out out/witness/conformance.json \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    echo "$output" | jq -e '.result.scope == "current-minimum-shared-surface"' >/dev/null
    echo "$output" | jq -e '.result.summary.failed == 0' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "continuum.delivery-vs-receipt-separation" and .status == "pass")' >/dev/null
    assert_file_exist out/witness/conformance.json
}

@test "witness-continuum fails when mocked deliveries drift from summary" {
    generate_local_inspect_surfaces

    jq '.mock.observationCount = 99' out/echo/mock/summary.json > out/echo/mock/summary.tmp
    mv out/echo/mock/summary.tmp out/echo/mock/summary.json

    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir out/ttd \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    assert_output --partial "Continuum witness failed"
    assert_file_exist out/witness/conformance.json
    run jq -e '.status == "fail" and .summary.failed > 0' out/witness/conformance.json
    assert_success
    run jq -e '.checks[] | select(.id == "echo.mock-deliveries-summary" and .status == "fail")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum accepts slash-heavy surface directories" {
    generate_local_inspect_surfaces

    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir "out/ttd///" \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir "out/echo///" \
        --out out/witness/conformance.json \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/witness/conformance.json
}
