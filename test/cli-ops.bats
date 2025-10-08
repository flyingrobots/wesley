#!/usr/bin/env bats

load 'helpers'

setup() {
  export CLI_PATH="$BATS_TEST_DIRNAME/../packages/wesley-host-node/bin/wesley.mjs"
  export TEMP_DIR="$(mktemp -d)"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

@test "--ops compiles .op.json to functions (and view when paramless) and emits pgTAP" {
  local output_dir="$TEMP_DIR/gen"
  run node "$CLI_PATH" generate --schema "$BATS_TEST_DIRNAME/../example/ecommerce.graphql" --ops "$BATS_TEST_DIRNAME/../example/ops" --out-dir "$output_dir" --allow-dirty --quiet
  assert_success

  # Functions emitted for all ops
  assert_file_exists "$output_dir/ops/products_by_name.fn.sql"
  assert_file_exists "$output_dir/ops/orders_by_user.fn.sql"
  assert_file_exists "$output_dir/ops/orders_with_items_by_user.fn.sql"
  assert_file_exists "$output_dir/ops/all_products.fn.sql"

  # View emitted for paramless op
  assert_file_exists "$output_dir/ops/all_products.view.sql"

  # Ops pgTAP suite emitted
  assert_file_exists "$output_dir/tests-ops.sql"
  run grep -q "wes_ops.op_all_products" "$output_dir/tests-ops.sql"
  assert_success
}

