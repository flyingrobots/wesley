#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-ops-collision-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'GQL'
type product @wes_table { id: ID! @wes_pk, name: String! }
GQL
}

create_colliding_ops() {
  mkdir -p ops
  cat > ops/orders_by_user.op.json << 'JSON'
{ "name": "orders_by_user", "table": "product" }
JSON
  cat > ops/orders-by-user.op.json << 'JSON'
{ "name": "orders-by-user", "table": "product" }
JSON
}

@test "collision on sanitized names fails" {
  create_schema
  create_colliding_ops
  run node "$CLI_PATH" generate --schema schema.graphql --ops ./ops --out-dir out --quiet
  assert_failure
  # Should not create duplicated outputs
  if [[ -d out/ops ]]; then
    echo "ops dir exists: contents:"; ls -la out/ops
  fi
}

