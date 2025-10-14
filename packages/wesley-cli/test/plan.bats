#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-plan-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'EOF'
type Org @wes_table {
  id: ID! @wes_pk
}

type User @wes_table {
  id: ID! @wes_pk
  org_id: ID! @wes_fk(ref: "Org.id")
}
EOF
}

@test "plan --explain prints phases" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --explain
  assert_success
  assert_output --partial "expand"
  assert_output --partial "backfill"
  assert_output --partial "validate"
  assert_output --partial "switch"
  assert_output --partial "contract"
}

@test "plan --map shows change mapping" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --map
  assert_success
  assert_output --partial "Change Mapping"
  assert_output --partial "type Org added"
}

@test "plan --write creates migration files" {
  create_schema
  run node "$CLI_PATH" plan --schema schema.graphql --write --out-dir out
  assert_success
  [ -f out/migrations/001_expand.sql ]
}

create_previous_snapshot_with_table() {
  mkdir -p .wesley
  cat > .wesley/snapshot.json <<'EOF'
{
  "irVersion": "1.0.0",
  "tables": [
    {
      "name": "User",
      "columns": [
        { "name": "id", "type": "uuid", "nullable": false }
      ],
      "indexes": [],
      "foreignKeys": [],
      "primaryKey": "id"
    }
  ]
}
EOF
}

create_schema_with_required_column() {
  cat > schema.graphql <<'EOF'
type User @wes_table {
  id: ID! @wes_pk
  email: String! @wes_unique @wes_default(value: "'placeholder@example.com'")
}
EOF
}

@test "plan writes per-phase SQL for new NOT NULL column" {
  create_previous_snapshot_with_table
  create_schema_with_required_column
  run node "$CLI_PATH" plan --schema schema.graphql --write --out-dir out
  assert_success
  [ -f out/migrations/001_expand.sql ]
  [ -f out/migrations/002_backfill.sql ]
  [ -f out/migrations/003_validate.sql ] || true
  [ -f out/migrations/004_switch.sql ]
  grep -q "UPDATE" out/migrations/002_backfill.sql || fail "Expected UPDATE statement in backfill phase"
  grep -q "SET NOT NULL" out/migrations/004_switch.sql || fail "Expected SET NOT NULL in switch phase"
}
