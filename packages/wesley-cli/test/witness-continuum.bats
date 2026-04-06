#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)"
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

@test "witness-continuum fails when mocked deliveries lose required observation fields" {
    generate_local_inspect_surfaces

    node - <<'EOF'
const fs = require('fs');
const rows = fs.readFileSync('out/echo/mock/deliveries.jsonl', 'utf8')
  .trim()
  .split('\n')
  .map(JSON.parse)
  .map((row) => ({
    envelope: row.envelope,
    data: {
      outcome: row.data.outcome
    }
  }));
fs.writeFileSync('out/echo/mock/deliveries.jsonl', rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
EOF

    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir out/ttd \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.checks[] | select(.id == "echo.mock-deliveries-shape" and .status == "fail")' out/witness/conformance.json
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

@test "witness-continuum accepts mixed relative and absolute schema paths for the same Echo schema" {
    cd "$REPO_ROOT"
    node "$CLI_PATH" compile-ttd --schema schemas/ttd-protocol.graphql --out-dir "$TEST_TEMP_DIR/out/ttd" >/dev/null
    node "$CLI_PATH" bundle-echo --schema schemas/echo-core-types.graphql --out-dir "$TEST_TEMP_DIR/out/echo" >/dev/null
    cd "$TEST_TEMP_DIR"

    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir "$TEST_TEMP_DIR/out/ttd" \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir "$TEST_TEMP_DIR/out/echo" \
        --out "$TEST_TEMP_DIR/out/witness/conformance.json" \
        --json
    assert_success
    echo "$output" | jq -e '.result.checks[] | select(.id == "echo.summary-traceability" and .status == "pass")' >/dev/null
}

@test "witness-continuum reports missing slash-heavy directories cleanly" {
    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir "out/ttd///" \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir "out/echo///" \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.surfaces.ttd.missingFiles | index("manifest/schema.json")' out/witness/conformance.json
    assert_success
    run jq -e '.surfaces.echo.missingFiles | index("mock/summary.json")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum dry-run failure does not point at a report file that was not written" {
    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --ttd-dir out/ttd \
        --echo-schema "$ECHO_SCHEMA" \
        --echo-dir out/echo \
        --out out/witness/conformance.json \
        --dry-run
    assert_failure
    refute_output --partial "See out/witness/conformance.json"
    assert_file_not_exist out/witness/conformance.json
}
