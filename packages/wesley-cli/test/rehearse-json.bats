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
  echo "$json" | jq -e '.events | map(.type) == ["RunRequested","IRParsed","SourcesResolved","PlanBuilt","RunCompleted"]' >/dev/null
}
