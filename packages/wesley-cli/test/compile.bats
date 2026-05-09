#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    FIXTURE_MODULE="$BATS_TEST_DIRNAME/fixtures/modules/test-extension-module.mjs"

    cat > schema.graphql <<'EOF'
type Todo {
  id: ID!
}
EOF
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "compile help describes module-provided targets" {
    run node "$CLI_PATH" compile --help
    assert_success
    assert_output --partial "Compile one GraphQL contract family"
    assert_output --partial "--schema"
    assert_output --partial "--target"
    assert_output --partial "module-provided targets"
    refute_output --partial "--emit"
    refute_output --partial "warp-ttd"
    refute_output --partial "echo"
}

@test "compile fails clearly when no module target is loaded" {
    run node "$CLI_PATH" --json compile --schema schema.graphql --dry-run
    assert_failure

    echo "$output" | jq -e '.success == false' >/dev/null
    echo "$output" | jq -e '.code == "NO_COMPILE_TARGETS"' >/dev/null
    echo "$output" | jq -e '.error | contains("Load a Wesley module")' >/dev/null
}

@test "compile dispatches all discovered module targets by default" {
    WESLEY_MODULES="$FIXTURE_MODULE" run node "$CLI_PATH" --json compile --schema schema.graphql --out-dir out --dry-run
    assert_success

    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.targets == ["fixture-target"]' >/dev/null
    echo "$output" | jq -e '.result.generatedTargets["fixture-target"].moduleName == "test-extension-module"' >/dev/null
    echo "$output" | jq -e '.result.generatedTargets["fixture-target"].result.kind == "fixture.compile-target.v1"' >/dev/null
    echo "$output" | jq -e '.result.generatedTargets["fixture-target"].result.outDir == "out/fixture-target"' >/dev/null
    echo "$output" | jq -e '.result.realizationManifest == null' >/dev/null

    assert_file_not_exist out/realization/manifest.json
}

@test "compile validates requested targets against loaded modules" {
    WESLEY_MODULES="$FIXTURE_MODULE" run node "$CLI_PATH" --json compile --schema schema.graphql --target echo --dry-run
    assert_failure

    echo "$output" | jq -e '.success == false' >/dev/null
    echo "$output" | jq -e '.code == "INVALID_TARGET"' >/dev/null
    echo "$output" | jq -e '.error | contains("fixture-target")' >/dev/null
    echo "$output" | jq -e '.error | contains("echo")' >/dev/null
}
