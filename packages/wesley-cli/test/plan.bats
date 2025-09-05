#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-plan-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'EOF'
type Org @wes_table {
  id: ID! @wes_pk
}

type User @wes_table {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Org.id")
}
EOF
}

@test "plan --explain prints phases" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --explain
  assert_success
  assert_output --partial "expand"
  assert_output --partial "validate"
}

@test "plan --write creates migration files" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --write --out-dir out
  assert_success
  [ -f out/migrations/001_expand.sql ]
}

