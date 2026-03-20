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
  "transmutation": "legacy-supabase",
  "runId": "run-realm-123",
  "provider": "postgres",
  "verdict": "PASS",
  "duration_ms": 10,
  "steps": 1,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
JSON
}

@test "cert sign + verify with two different keys (C5 multi-sig)" {
  create_schema
  create_realm_pass

  run node "$CLI_PATH" transform --schema schema.graphql --out-dir out
  assert_success

  run node "$CLI_PATH" cert-create --env test --out .wesley/SHIPME.md
  assert_success

  command -v openssl >/dev/null || skip "openssl not available"

  # Two distinct key pairs
  openssl genpkey -algorithm ed25519 -out alice.key >/dev/null 2>&1
  openssl pkey -in alice.key -pubout -out alice.pub >/dev/null 2>&1
  openssl genpkey -algorithm ed25519 -out bob.key >/dev/null 2>&1
  openssl pkey -in bob.key -pubout -out bob.pub >/dev/null 2>&1

  # First signature
  run node "$CLI_PATH" cert-sign --in .wesley/SHIPME.md --key alice.key --signer ALICE
  assert_success

  # Second signature
  run node "$CLI_PATH" cert-sign --in .wesley/SHIPME.md --key bob.key --signer BOB
  assert_success

  # Verify both signatures pass (variadic --pub takes space-separated values)
  run node "$CLI_PATH" cert-verify --in .wesley/SHIPME.md --pub alice.pub bob.pub --json
  assert_success
  echo "$output" | jq -e '.validSignatures == 2' >/dev/null
}

@test "cert-create --json carries transmutation and runId metadata" {
  create_realm_pass

  run node "$CLI_PATH" cert-create --env test --json
  assert_success
  echo "$output" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$output" | jq -e '.runId == "run-realm-123"' >/dev/null
  echo "$output" | jq -e '.realm.transmutation == "legacy-supabase"' >/dev/null
  echo "$output" | jq -e '.realm.runId == "run-realm-123"' >/dev/null
  echo "$output" | jq -e '.run.command == "cert-create"' >/dev/null
  echo "$output" | jq -e '.run.status == "completed"' >/dev/null
  echo "$output" | jq -e '.events | map(.type) == ["RunRequested","SourcesResolved","CertificateIssued","RunCompleted"]' >/dev/null
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
