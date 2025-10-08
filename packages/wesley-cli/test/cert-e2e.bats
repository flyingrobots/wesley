#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-cert-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'EOF'
type User @wes_table { id: ID! @wes_pk }
EOF
}

create_realm_pass() {
  mkdir -p .wesley
  cat > .wesley/realm.json << 'JSON'
{
  "provider": "postgres",
  "verdict": "PASS",
  "duration_ms": 10,
  "steps": 1,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
JSON
}

@test "cert create + sign + verify succeeds with PASS realm" {
  create_schema
  create_realm_pass
  # transform to produce artifacts
  run node "$CLI_PATH" transform --schema schema.graphql --out-dir out
  assert_success

  # create SHIPME
  run node "$CLI_PATH" cert-create --env test --out .wesley/SHIPME.md
  assert_success
  assert_file_exist .wesley/SHIPME.md

  # if openssl missing, skip signing
  command -v openssl >/dev/null || skip "openssl not available"

  # generate keys
  openssl genpkey -algorithm ed25519 -out holmes.key >/dev/null 2>&1
  openssl pkey -in holmes.key -pubout -out holmes.pub >/dev/null 2>&1

  # sign
  run node "$CLI_PATH" cert-sign --in .wesley/SHIPME.md --key holmes.key --signer HOLMES
  assert_success

  # verify
  run node "$CLI_PATH" cert-verify --in .wesley/SHIPME.md --pub holmes.pub --json
  assert_success
  echo "$output" | jq -e '.ok == true' >/dev/null
}
