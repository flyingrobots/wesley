#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-null-generator-XXXXXX)"
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

@test "transform runs the null-generator transmutation via registration only" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation null-generator --out-dir out
  assert_success
  assert_file_exist "out/null/summary.json"
  run jq -r '.transmutation' out/null/summary.json
  assert_success
  assert_output "null-generator"
  run jq -r '.outputDir' out/null/summary.json
  assert_success
  assert_output "out"
}
