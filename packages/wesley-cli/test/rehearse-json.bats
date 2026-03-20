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
  local json
  json=$(echo "$output" | jq -s 'map(select(has("plan"))) | first')
  [[ -n "$json" ]] || fail "No JSON output with plan data"
  echo "$json" | jq -e '.plan and .explain' >/dev/null
  echo "$json" | jq -e '.explain.steps | length >= 1' >/dev/null
}

@test "rehearse --dry-run --json carries transmutation and runId metadata" {
  create_schema
  run node "$CLI_PATH" rehearse --schema schema.graphql --dry-run --json --transmutation legacy-supabase --run-id run-rehearse-123
  assert_success
  local json
  json=$(echo "$output" | jq -s 'map(select(has("plan"))) | first')
  [[ -n "$json" ]] || fail "No JSON output with plan data"
  echo "$json" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$json" | jq -e '.runId == "run-rehearse-123"' >/dev/null
  echo "$json" | jq -e '.run.command == "rehearse"' >/dev/null
  echo "$json" | jq -e '.run.status == "completed"' >/dev/null
  echo "$json" | jq -e '.events | map(.type) == ["RunRequested","IRParsed","SourcesResolved","PlanBuilt","RunCompleted"]' >/dev/null
}

@test "rehearse --json failure preserves run envelope" {
  create_schema
  run node "$CLI_PATH" rehearse --schema schema.graphql --provider supabase --json --transmutation legacy-supabase --run-id run-rehearse-fail-123
  assert_failure 2
  echo "$output" | jq -e '.success == false' >/dev/null
  echo "$output" | jq -e '.code == "NO_DSN"' >/dev/null
  echo "$output" | jq -e '.runId == "run-rehearse-fail-123"' >/dev/null
  echo "$output" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$output" | jq -e '.run.command == "rehearse"' >/dev/null
  echo "$output" | jq -e '.run.status == "failed"' >/dev/null
  echo "$output" | jq -e '.run.failure.code == "NO_DSN"' >/dev/null
  echo "$output" | jq -e '.events | map(.type) == ["RunRequested","IRParsed","SourcesResolved","PlanBuilt","RunFailed"]' >/dev/null
}

@test "rehearse --dry-run --resume completes a partial run without duplicating events" {
  create_schema

  run env WESLEY_CRASH_AFTER_EVENT=4 node "$CLI_PATH" rehearse --schema schema.graphql --dry-run --json --transmutation legacy-supabase --run-id run-rehearse-resume-123
  assert_failure 6

  run node "$CLI_PATH" rehearse --schema schema.graphql --dry-run --json --transmutation legacy-supabase --run-id run-rehearse-resume-123 --resume
  assert_success
  local json
  json=$(echo "$output" | jq -s 'map(select(has("plan"))) | first')
  [[ -n "$json" ]] || fail "No JSON output with resumed rehearsal data"
  echo "$json" | jq -e '.resumed == true' >/dev/null
  echo "$json" | jq -e '.shortCircuited == false' >/dev/null
  echo "$json" | jq -e '.run.status == "completed"' >/dev/null
  echo "$json" | jq -e '.events | map(.type) == ["RunRequested","IRParsed","SourcesResolved","PlanBuilt","RunCompleted"]' >/dev/null
}

@test "rehearse --dry-run --resume short-circuits an already completed run" {
  create_schema

  run node "$CLI_PATH" rehearse --schema schema.graphql --dry-run --json --transmutation legacy-supabase --run-id run-rehearse-shortcircuit-123
  assert_success

  run node "$CLI_PATH" rehearse --schema schema.graphql --dry-run --json --transmutation legacy-supabase --run-id run-rehearse-shortcircuit-123 --resume
  assert_success
  echo "$output" | jq -e '.result.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.run.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.events | length == 5' >/dev/null
}
