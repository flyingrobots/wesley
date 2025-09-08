#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-plan-json-XXXXXX)"
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

@test "plan --explain --json contains locks and steps" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --explain --json
  assert_success
  # Has plan + explain keys
  echo "$output" | jq -e '.plan and .explain' >/dev/null
  # Contains CIC step
  echo "$output" | jq -e '.explain.steps | map(select(.op=="create_index_concurrently")) | length > 0' >/dev/null
  # Contains validate_fk step
  echo "$output" | jq -e '.explain.steps | map(select(.op=="validate_fk")) | length > 0' >/dev/null
}

