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

@test "contract release help works" {
    run node "$CLI_PATH" contract release --help
    assert_success
    assert_output --partial "Assemble one versioned contract bundle from one authored family"
    assert_output --partial "--family"
    assert_output --partial "--bundle-out"
}

@test "contract release assembles a witnessed bundle" {
    cp "$CONTINUUM_SCHEMA" schema.graphql

    run node "$CLI_PATH" contract release \
        --profile continuum \
        --family receipt-family \
        --schema schema.graphql \
        --release 0.1.0 \
        --bundle-out out/bundle \
        --json

    assert_success
    echo "$output" | jq -e '.success == true and .result.profile == "continuum" and .result.family == "receipt-family" and .result.witness.status == "pass"' >/dev/null
    assert_file_exist out/bundle/bundle.json
    assert_file_exist out/bundle/source/authority.json
    assert_file_exist out/bundle/source/admitted.graphql
    assert_file_exist out/bundle/realization/manifest.json
    assert_file_exist out/bundle/witness/conformance.json
    assert_file_exist out/bundle/targets/warp-ttd/manifest/manifest.json
    assert_file_exist out/bundle/targets/echo/ir.json
    run jq -e '.kind == "wesley.contract.bundle.v1" and (.compatibility.consumers | length) == 2' out/bundle/bundle.json
    assert_success
}

@test "contract sync copies declared projections into warp-ttd and echo roots" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" contract release \
        --profile continuum \
        --family receipt-family \
        --schema schema.graphql \
        --release 0.1.0 \
        --bundle-out out/bundle >/dev/null

    mkdir -p consumers/warp-ttd consumers/echo/packages/ttd-protocol-ts

    run node "$CLI_PATH" contract sync \
        --profile continuum \
        --bundle out/bundle \
        --consumer warp-ttd \
        --repo consumers/warp-ttd \
        --json
    assert_success
    echo "$output" | jq -e '.success == true and .result.consumer == "warp-ttd" and .result.fileCount > 2' >/dev/null
    assert_file_exist consumers/warp-ttd/manifest/manifest.json
    assert_file_exist consumers/warp-ttd/typescript/index.ts

    run node "$CLI_PATH" contract sync \
        --profile continuum \
        --bundle out/bundle \
        --consumer echo \
        --repo consumers/echo \
        --json
    assert_success
    echo "$output" | jq -e '.success == true and .result.consumer == "echo" and .result.fileCount == 4' >/dev/null
    assert_file_exist consumers/echo/packages/ttd-protocol-ts/index.ts
    assert_file_exist consumers/echo/packages/ttd-protocol-ts/zod.ts
}
