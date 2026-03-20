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
  assert_output --partial "--resume"
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

@test "blade --resume requires --run-id" {
  create_min_schema
  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --resume --json --quiet
  assert_failure 2
  echo "$output" | jq -e '.code == "EUSAGE"' >/dev/null
}

@test "blade --resume completes a partial pipeline and reports stage state" {
  create_min_schema

  run env WESLEY_CRASH_AFTER_EVENT=4 node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-resume-123 --json --quiet
  assert_failure 6

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-resume-123 --resume --json --quiet
  assert_success
  echo "$output" | jq -e '.result.runId == "run-blade-resume-123"' >/dev/null
  echo "$output" | jq -e '.result.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.shortCircuited == false' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.stages.plan.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.stages.rehearse.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.stages.certCreate.status == "completed"' >/dev/null
}

@test "blade --resume short-circuits completed stage runs" {
  create_min_schema

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-shortcircuit-123 --json --quiet
  assert_success

  run node "$CLI_PATH" blade --schema schema.graphql --out-dir out --dry-run --transmutation legacy-supabase --run-id run-blade-shortcircuit-123 --resume --json --quiet
  assert_success
  echo "$output" | jq -e '.result.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.stages.transform.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.stages.plan.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.stages.rehearse.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.stages.certCreate.shortCircuited == true' >/dev/null
}
