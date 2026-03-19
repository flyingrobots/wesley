#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-blade-XXXXXX)"
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

@test "blade help works" {
  run node "$CLI_PATH" blade --help
  assert_success
  assert_output --partial "One-shot: transform"
  assert_output --partial "--transmutation"
  assert_output --partial "--run-id"
}

@test "blade dry-run completes and writes cert in .wesley" {
  create_min_schema
  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run
  assert_success
  assert_file_exist .wesley/SHIPME.md
}

@test "blade dry-run carries run metadata into SHIPME" {
  create_min_schema
  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-123
  assert_success
  assert_file_exist .wesley/SHIPME.md
  local json
  json=$(sed -n '/```json/,/```/p' .wesley/SHIPME.md | sed '1d;$d')
  [[ -n "$json" ]] || fail "No embedded SHIPME JSON block found"
  echo "$json" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$json" | jq -e '.runId == "run-blade-123"' >/dev/null
  echo "$json" | jq -e '.realm == null' >/dev/null
}
