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
  local json
  json=$(echo "$output" | jq -s 'map(select(has("plan"))) | first')
  [[ -n "$json" ]] || fail "No JSON output with plan data"
  # Has plan + explain keys
  echo "$json" | jq -e '.plan and .explain' >/dev/null
  # Contains CIC step
  echo "$json" | jq -e '.explain.steps | map(select(.op=="create_index_concurrently")) | length > 0' >/dev/null
  # Contains validate_fk step
  echo "$json" | jq -e '.explain.steps | map(select(.op=="validate_fk")) | length > 0' >/dev/null
}

@test "plan --json carries transmutation and runId metadata" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --json --transmutation legacy-supabase --run-id run-plan-123
  assert_success
  local json
  json=$(echo "$output" | jq -s 'map(select(has("plan"))) | first')
  [[ -n "$json" ]] || fail "No JSON output with plan data"
  echo "$json" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$json" | jq -e '.runId == "run-plan-123"' >/dev/null
  echo "$json" | jq -e '.run.command == "plan"' >/dev/null
  echo "$json" | jq -e '.run.status == "completed"' >/dev/null
  echo "$json" | jq -e '.events | map(.type) == ["RunRequested","IRParsed","SourcesResolved","PlanBuilt","RunCompleted"]' >/dev/null
}

@test "plan --resume completes a partial persisted plan run without duplicating events" {
  create_schema

  run env WESLEY_CRASH_AFTER_EVENT=4 node "$CLI_PATH" plan --schema schema.graphql --json --transmutation legacy-supabase --run-id run-plan-resume-123
  assert_failure 6

  run node "$CLI_PATH" plan --schema schema.graphql --json --transmutation legacy-supabase --run-id run-plan-resume-123 --resume
  assert_success
  local json
  json=$(echo "$output" | jq -s 'map(select(has("plan"))) | first')
  [[ -n "$json" ]] || fail "No JSON output with resumed plan data"
  echo "$json" | jq -e '.resumed == true' >/dev/null
  echo "$json" | jq -e '.shortCircuited == false' >/dev/null
  echo "$json" | jq -e '.run.status == "completed"' >/dev/null
  echo "$json" | jq -e '.events | map(.type) == ["RunRequested","IRParsed","SourcesResolved","PlanBuilt","RunCompleted"]' >/dev/null
}

@test "plan --resume short-circuits an already completed run" {
  create_schema

  run node "$CLI_PATH" plan --schema schema.graphql --json --transmutation legacy-supabase --run-id run-plan-shortcircuit-123
  assert_success

  run node "$CLI_PATH" plan --schema schema.graphql --json --transmutation legacy-supabase --run-id run-plan-shortcircuit-123 --resume
  assert_success
  local json
  json=$(echo "$output" | jq '.')
  echo "$json" | jq -e '.result.resumed == true' >/dev/null
  echo "$json" | jq -e '.result.shortCircuited == true' >/dev/null
  echo "$json" | jq -e '.result.run.status == "completed"' >/dev/null
  echo "$json" | jq -e '.result.events | length == 5' >/dev/null
}
