#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-rehearse-json-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'EOF'
type Org @wes_table { id: ID! @wes_pk }
type User @wes_table { id: ID! @wes_pk org_id: ID! @wes_fk(ref: "Org.id") }
EOF
}

@test "rehearse --dry-run --json returns plan + explain" {
  create_schema
  run node "$CLI_PATH" rehearse --schema schema.graphql --dry-run --json
  assert_success
  echo "$output" | jq -e '.plan and .explain' >/dev/null
  echo "$output" | jq -e '.explain.steps | length >= 1' >/dev/null
}

