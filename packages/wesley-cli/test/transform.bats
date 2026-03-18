#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-transform-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_min_schema() {
  cat > schema.graphql << 'EOF'
type User @wes_table {
  id: ID! @wes_pk
}
EOF
}

@test "transform help works" {
  run node "$CLI_PATH" transform --help
  assert_success
  assert_output --partial "Run a named transmutation"
  assert_output --partial "--transmutation"
}

@test "transform missing schema exits 2" {
  run node "$CLI_PATH" transform --schema ./does-not-exist.graphql
  assert_failure 2
}

@test "transform runs successfully on minimal schema" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --out-dir out
  assert_success
  # Out directory should exist (writer stubs may create files)
}

@test "transform rejects unknown transmutation" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation nope
  assert_failure 2
  assert_output --partial "UNKNOWN_TRANSMUTATION"
  assert_output --partial "legacy-supabase"
}
