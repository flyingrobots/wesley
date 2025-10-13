#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-transform-XXXXXX)"
  export TEST_TEMP_DIR
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
  export CLI_PATH
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
  assert_output --partial "Transform GraphQL schema"
}

@test "transform missing schema exits 2" {
  run node "$CLI_PATH" transform --schema ./does-not-exist.graphql
  assert_failure 2
}

@test "transform runs successfully on minimal schema" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --out-dir out
  assert_success
  # Out directory should exist (writer stubs may create files)
}
