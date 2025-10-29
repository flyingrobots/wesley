#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-plan-radar-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'EOF'
type Org @wes_table { id: ID! @wes_pk }
type User @wes_table { id: ID! @wes_pk org_id: ID! @wes_fk(ref: "Org.id") created_at: DateTime @wes_index }
EOF
}

@test "plan --radar prints Lock Radar section" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --explain --radar
  assert_success
  assert_output --partial "Lock Radar"
}

