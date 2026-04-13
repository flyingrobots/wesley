#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    CONTINUUM_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "verify-realization help works" {
    run node "$CLI_PATH" verify-realization --help
    assert_success
    assert_output --partial "Verify realization manifest sourceHash and artifact signatures"
    assert_output --partial "--tracked"
    assert_output --partial "--out-dir"
}

@test "verify-realization passes for a compiled output root" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    run node "$CLI_PATH" verify-realization --out-dir out/proof --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    echo "$output" | jq -e '.result.summary.failed == 0' >/dev/null
}

@test "verify-realization fails when the authored schema drifts from sourceHash" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    cat >> schema.graphql <<'EOF'

type ReleaseDriftCanary {
  id: ID!
}
EOF

    run node "$CLI_PATH" verify-realization --out-dir out/proof
    assert_failure
    assert_output --partial "Realization verification failed"
}

@test "verify-realization fails when a generated artifact drifts from its signature" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    printf '\n// drift\n' >> out/proof/echo/schemas.generated.ts

    run node "$CLI_PATH" verify-realization --out-dir out/proof
    assert_failure
    assert_output --partial "Realization verification failed"
}

@test "verify-realization --tracked verifies git-known realization manifests" {
    git init -q
    git config user.name "Wesley Test"
    git config user.email "wesley@example.com"

    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    git add schema.graphql out/proof

    run node "$CLI_PATH" verify-realization --tracked --repo-root . --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.mode == "tracked" and .result.manifestCount == 1 and .result.status == "pass"' >/dev/null
}
