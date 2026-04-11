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

@test "compile help works" {
    run node "$CLI_PATH" compile --help
    assert_success
    assert_output --partial "Compile one GraphQL contract family"
    assert_output --partial "--schema"
    assert_output --partial "--target"
    assert_output --partial "--emit"
    assert_output --partial "--out-dir"
}

@test "compile writes warp-ttd and Echo targets under one output root" {
    run node "$CLI_PATH" compile --schema "$CONTINUUM_SCHEMA" --target warp-ttd,echo --out-dir out --json
    assert_success

    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.targets == ["warp-ttd","echo"]' >/dev/null
    echo "$output" | jq -e '.result.witness.kind == "wesley.compile.witness.v1"' >/dev/null
    echo "$output" | jq -e '.result.witnessPath == "out/witness/compile.json"' >/dev/null
    echo "$output" | jq -e '.result.warpTtd.files | map(.path) | index("out/warp-ttd/manifest/manifest.json") != null' >/dev/null
    echo "$output" | jq -e '.result.echo.outDir == "out/echo"' >/dev/null
    echo "$output" | jq -e '.result.schemaHash == .result.warpTtd.schemaHash and .result.schemaHash == .result.echo.schemaHash' >/dev/null

    assert_file_exist out/warp-ttd/manifest/schema.json
    assert_file_exist out/warp-ttd/typescript/types.ts
    assert_file_exist out/echo/ir.json
    assert_file_exist out/echo/mock/deliveries.jsonl
    assert_file_exist out/echo/mock/summary.json
    assert_file_exist out/witness/compile.json
    run jq -e '.kind == "wesley.compile.witness.v1" and .targets == ["warp-ttd","echo"] and .generatedLegs.warpTtd != null and .generatedLegs.echo != null' out/witness/compile.json
    assert_success
}

@test "compile can target echo only" {
    run node "$CLI_PATH" compile --schema "$CONTINUUM_SCHEMA" --target echo --out-dir out --json
    assert_success

    echo "$output" | jq -e '.result.targets == ["echo"]' >/dev/null
    echo "$output" | jq -e '.result.warpTtd == null' >/dev/null
    echo "$output" | jq -e '.result.echo.outDir == "out/echo"' >/dev/null
    echo "$output" | jq -e '.result.witness.generatedLegs.warpTtd == null and .result.witness.generatedLegs.echo != null' >/dev/null

    assert_file_not_exist out/warp-ttd/manifest/schema.json
    assert_file_exist out/echo/ir.json
    assert_file_exist out/witness/compile.json
}

@test "compile dry-run does not write compile witness file" {
    run node "$CLI_PATH" compile --schema "$CONTINUUM_SCHEMA" --target warp-ttd,echo --out-dir out --dry-run --json
    assert_success

    echo "$output" | jq -e '.result.dryRun == true' >/dev/null
    echo "$output" | jq -e '.result.witness.kind == "wesley.compile.witness.v1"' >/dev/null
    assert_file_not_exist out/witness/compile.json
}
