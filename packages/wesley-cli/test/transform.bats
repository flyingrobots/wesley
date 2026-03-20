#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-transform-XXXXXX)"
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

@test "transform help works" {
  run node "$CLI_PATH" transform --help
  assert_success
  assert_output --partial "Run a named transmutation"
  assert_output --partial "--transmutation"
  assert_output --partial "--run-id"
}

@test "transform missing schema exits 2" {
  run node "$CLI_PATH" transform --schema ./does-not-exist.graphql
  assert_failure 2
}

@test "transform runs successfully on minimal schema" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --out-dir out
  assert_success
  # Out directory should exist (writer stubs may create files)
}

@test "transform --json preserves caller-supplied runId" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-transform-123 --out-dir out --json --quiet
  assert_success
  local json
  json=$(printf '%s' "$output" | jq '.')
  [[ -n "$json" ]] || fail "No JSON output with result payload"
  echo "$json" | jq -e '.result.transmutation == "legacy-supabase"' >/dev/null
  echo "$json" | jq -e '.result.runId == "run-transform-123"' >/dev/null
  echo "$json" | jq -e '.result.run.command == "transform"' >/dev/null
  echo "$json" | jq -e '.result.run.status == "completed"' >/dev/null
  echo "$json" | jq -e '.result.events | map(.type) == ["RunRequested","SourcesResolved","IRParsed","TaskGraphBuilt","TaskStarted","TaskCompleted","EvidenceMerged","ScoresComputed","ArtifactsMaterialized","RunCompleted"]' >/dev/null
}

@test "transform rejects unknown transmutation" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation nope
  assert_failure 2
  assert_output --partial "UNKNOWN_TRANSMUTATION"
  assert_output --partial "legacy-supabase"
}

@test "transform --json failure preserves run envelope" {
  create_min_schema
  run node "$CLI_PATH" transform --schema schema.graphql --transmutation nope --run-id run-transform-fail-123 --json --quiet
  assert_failure 2
  echo "$output" | jq -e '.success == false' >/dev/null
  echo "$output" | jq -e '.code == "UNKNOWN_TRANSMUTATION"' >/dev/null
  echo "$output" | jq -e '.runId == "run-transform-fail-123"' >/dev/null
  echo "$output" | jq -e '.transmutation == "nope"' >/dev/null
  echo "$output" | jq -e '.run.command == "transform"' >/dev/null
  echo "$output" | jq -e '.run.status == "failed"' >/dev/null
  echo "$output" | jq -e '.events | map(.type) == ["RunRequested","SourcesResolved","RunFailed"]' >/dev/null
}
