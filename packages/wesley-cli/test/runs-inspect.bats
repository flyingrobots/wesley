#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-runs-inspect-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'EOF'
type User @wes_table {
  id: ID! @wes_pk
}
EOF
}

@test "runs inspect reads a persisted transform run by runId" {
  create_schema

  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-ledger-123 --out-dir out --json --quiet
  assert_success

  run node "$CLI_PATH" runs inspect --run-id run-ledger-123 --json
  assert_success
  echo "$output" | jq -e '.run.runId == "run-ledger-123"' >/dev/null
  echo "$output" | jq -e '.run.transmutation == "legacy-supabase"' >/dev/null
  echo "$output" | jq -e '.run.command == "transform"' >/dev/null
  echo "$output" | jq -e '.run.status == "completed"' >/dev/null
  echo "$output" | jq -e '.events | map(.type) == ["RunRequested","SourcesResolved","IRParsed","TaskGraphBuilt","TaskStarted","TaskCompleted","EvidenceMerged","ScoresComputed","ArtifactsMaterialized","RunCompleted"]' >/dev/null
}

@test "runs inspect reports missing runs as input errors" {
  run node "$CLI_PATH" runs inspect --run-id run-missing-123 --json
  assert_failure 2
  echo "$output" | jq -e '.code == "RUN_NOT_FOUND"' >/dev/null
}

@test "runs status lists persisted runs and supports status filters" {
  create_schema

  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-status-ok --out-dir out --json --quiet
  assert_success

  run node "$CLI_PATH" transform --schema schema.graphql --transmutation nope --run-id run-status-fail --json --quiet
  assert_failure 2

  run node "$CLI_PATH" runs status --json
  assert_success
  echo "$output" | jq -e '.count == 2' >/dev/null
  echo "$output" | jq -e '.runs | map(.runId) == ["run-status-fail","run-status-ok"]' >/dev/null
  echo "$output" | jq -e '.runs | map(.status) == ["failed","completed"]' >/dev/null

  run node "$CLI_PATH" runs status --status failed --json
  assert_success
  echo "$output" | jq -e '.count == 1' >/dev/null
  echo "$output" | jq -e '.runs[0].runId == "run-status-fail"' >/dev/null
  echo "$output" | jq -e '.runs[0].status == "failed"' >/dev/null
}

@test "runs replay rebuilds a completed run from persisted events" {
  create_schema

  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-replay-ok --out-dir out --json --quiet
  assert_success

  run node "$CLI_PATH" runs replay --run-id run-replay-ok --json
  assert_success
  echo "$output" | jq -e '.run.runId == "run-replay-ok"' >/dev/null
  echo "$output" | jq -e '.run.status == "completed"' >/dev/null
  echo "$output" | jq -e '.replay.integrity.valid == true' >/dev/null
  echo "$output" | jq -e '.replay.appliedEventCount == 10' >/dev/null
  echo "$output" | jq -e '.replay.terminal == true' >/dev/null
}

@test "runs replay reports partial non-terminal streams after injected crash" {
  create_schema

  run env WESLEY_CRASH_AFTER_EVENT=4 node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-replay-crash --out-dir out --json --quiet
  assert_failure 6

  run node "$CLI_PATH" runs replay --run-id run-replay-crash --transmutation legacy-supabase --json
  assert_success
  echo "$output" | jq -e '.run.status == "running"' >/dev/null
  echo "$output" | jq -e '.replay.integrity.valid == true' >/dev/null
  echo "$output" | jq -e '.replay.terminal == false' >/dev/null
  echo "$output" | jq -e '.replay.appliedEventCount == 4' >/dev/null
}

@test "runs doctor flags non-terminal and malformed streams" {
  create_schema

  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-doctor-ok --out-dir out --json --quiet
  assert_success

  run env WESLEY_CRASH_AFTER_EVENT=4 node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-doctor-crash --out-dir out --json --quiet
  assert_failure 6

  mkdir -p .wesley/ledger/streams
  cat > .wesley/ledger/streams/broken-stream.jsonl <<'EOF'
{"this":"is not valid jsonl"
EOF

  run node "$CLI_PATH" runs doctor --json
  assert_success
  echo "$output" | jq -e '.summary.streamCount == 3' >/dev/null
  echo "$output" | jq -e '.summary.healthyStreams == 1' >/dev/null
  echo "$output" | jq -e '.summary.unhealthyStreams == 2' >/dev/null
  echo "$output" | jq -e '.summary.nonTerminalStreams == 1' >/dev/null
  echo "$output" | jq -e '.summary.readErrorStreams == 1' >/dev/null
  echo "$output" | jq -e '.streams[] | select(.run.runId == "run-doctor-crash") | .findings[] | select(.code == "RUN_NON_TERMINAL")' >/dev/null
  echo "$output" | jq -e '.streams[] | select(.streamId == "broken-stream") | .findings[] | select(.code == "STREAM_READ_FAILED")' >/dev/null
}
