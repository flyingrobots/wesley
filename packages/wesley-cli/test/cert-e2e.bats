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
  mkdir -p .wesley-cache
  cat > .wesley-cache/realm.json << 'JSON'
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

create_counterfactual_summary() {
  local gate="${1:-audit}"
  local would_fail="${2:-true}"
  mkdir -p .wesley-cache/counterfactual
  cat > .wesley-cache/counterfactual/current.json << JSON
{
  "provider": "git-warp",
  "providerPackageVersion": "14.16.2",
  "surfaceVersion": "wesley-counterfactual-v1",
  "laneFingerprint": "lane-123",
  "composition": "merge",
  "requested": {
    "baseRef": "main",
    "headRef": "HEAD",
    "braidRefs": []
  },
  "resolved": {
    "baseRef": "main",
    "baseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "headRef": "HEAD",
    "headSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "braidRefs": [],
    "liveWorkspace": true
  },
  "facts": {
    "comparison": {
      "exportVersion": "1",
      "factKind": "coordinate-comparison",
      "factDigest": "cmp-123",
      "changed": true,
      "file": ".wesley-cache/counterfactual/comparison.cmp-123.json"
    },
    "transferPlan": {
      "exportVersion": "1",
      "factKind": "coordinate-transfer-plan",
      "factDigest": "xfer-123",
      "changed": true,
      "file": ".wesley-cache/counterfactual/transfer.xfer-123.json"
    },
    "normalizedScope": null
  },
  "judgment": {
    "status": "unsupported",
    "signals": ["provider_unavailable"],
    "riskClass": "high",
    "confidenceAdjustment": -50,
    "gate": "$gate",
    "wouldFail": $would_fail,
    "reasons": ["Counterfactual test summary"]
  }
}
JSON
}

create_bundle_with_citation_quality() {
  mkdir -p .wesley-cache
  cat > schema.sql << 'EOF'
one
two
three
EOF
  cat > tests.sql << 'EOF'
test line
second test line
EOF
  cat > .wesley-cache/bundle.json << 'JSON'
{
  "bundleVersion": "2.0.0",
  "sha": "abcdef1234567890abcdef1234567890abcdef12",
  "timestamp": "2026-03-21T00:00:00.000Z",
  "evidence": {
    "evidence": {
      "schema": {
        "sql": [
          { "file": "schema.sql", "lines": "1-3", "sha": "abcdef1234567890abcdef1234567890abcdef12" },
          { "file": "schema.sql", "lines": "1-*", "sha": "abcdef1234567890abcdef1234567890abcdef12" }
        ],
        "tests": [
          { "file": "tests.sql", "lines": "1-1", "sha": "abcdef1234567890abcdef1234567890abcdef12" }
        ]
      }
    }
  }
}
JSON
}

create_holmes_summary_inputs() {
  create_bundle_with_citation_quality
  cat > .wesley-cache/scores.json << 'JSON'
{
  "version": "1.0.0",
  "scores": {
    "scs": 0.95,
    "tci": 0.8,
    "mri": 0.1
  },
  "readiness": {
    "verdict": "ELEMENTARY"
  },
  "breakdown": {
    "scs": {
      "sql": { "score": 1, "earnedWeight": 1, "totalWeight": 1 },
      "types": { "score": 1, "earnedWeight": 1, "totalWeight": 1 },
      "validation": { "score": 1, "earnedWeight": 1, "totalWeight": 1 },
      "tests": { "score": 0.8, "earnedWeight": 0.8, "totalWeight": 1 }
    },
    "tci": {
      "unit_constraints": { "score": 1, "covered": 1, "total": 1 },
      "unit_rls": { "score": 1, "covered": 1, "total": 1 },
      "integration_relations": { "score": 1, "covered": 1, "total": 1 },
      "e2e_ops": { "score": 0.8, "covered": 4, "total": 5, "note": "fixture" }
    },
    "mri": {
      "drops": { "score": 0, "points": 0, "count": 0 },
      "renames_without_uid": { "score": 0, "points": 0, "count": 0 },
      "add_not_null_without_default": { "score": 0.1, "points": 1, "count": 1 },
      "non_concurrent_indexes": { "score": 0, "points": 0, "count": 0 },
      "totalPoints": 1
    }
  }
}
JSON
}

@test "cert sign + verify with two different keys (C5 multi-sig)" {
  create_schema
  create_realm_pass

  run node "$CLI_PATH" transform --schema schema.graphql --out-dir out
  assert_success

  run node "$CLI_PATH" cert-create --env test --out .wesley-cache/SHIPME.md
  assert_success

  command -v openssl >/dev/null || skip "openssl not available"

  # Two distinct key pairs
  openssl genpkey -algorithm ed25519 -out alice.key >/dev/null 2>&1
  openssl pkey -in alice.key -pubout -out alice.pub >/dev/null 2>&1
  openssl genpkey -algorithm ed25519 -out bob.key >/dev/null 2>&1
  openssl pkey -in bob.key -pubout -out bob.pub >/dev/null 2>&1

  # First signature
  run node "$CLI_PATH" cert-sign --in .wesley-cache/SHIPME.md --key alice.key --signer ALICE
  assert_success

  # Second signature
  run node "$CLI_PATH" cert-sign --in .wesley-cache/SHIPME.md --key bob.key --signer BOB
  assert_success

  # Verify both signatures pass (variadic --pub takes space-separated values)
  run node "$CLI_PATH" cert-verify --in .wesley-cache/SHIPME.md --pub alice.pub bob.pub --json
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

@test "cert-create embeds counterfactual summary when present" {
  create_realm_pass
  create_counterfactual_summary audit true

  run node "$CLI_PATH" cert-create --env test --json
  assert_success
  echo "$output" | jq -e '.counterfactual.gate == "audit"' >/dev/null
  echo "$output" | jq -e '.counterfactual.riskClass == "high"' >/dev/null
  echo "$output" | jq -e '.counterfactual.comparisonFactDigest == "cmp-123"' >/dev/null
}

@test "cert-create summarizes evidence citation quality in SHIPME JSON" {
  create_realm_pass
  create_bundle_with_citation_quality

  run node "$CLI_PATH" cert-create --env test --json
  assert_success
  echo "$output" | jq -e '.evidence.totalCitations == 3' >/dev/null
  echo "$output" | jq -e '.evidence.exact == 1' >/dev/null
  echo "$output" | jq -e '.evidence.wholeFile == 1' >/dev/null
  echo "$output" | jq -e '.evidence.coarse == 1' >/dev/null
  echo "$output" | jq -e '.evidence.strongestCitation == "exact"' >/dev/null
  echo "$output" | jq -e '.evidence.trust == "weak"' >/dev/null
  echo "$output" | jq -e '.evidence.reasons[0] | test("coarse citation")' >/dev/null
}

@test "cert-create embeds HOLMES summary when bundle evidence and scores are present" {
  create_realm_pass
  create_holmes_summary_inputs

  run node "$CLI_PATH" cert-create --env test --json
  assert_success
  echo "$output" | jq -e '.holmes.shipVerdict == "REQUIRES INVESTIGATION"' >/dev/null
  echo "$output" | jq -e '.holmes.baseReadiness == "ELEMENTARY"' >/dev/null
  echo "$output" | jq -e '.holmes.evidenceTrust == "weak"' >/dev/null
  echo "$output" | jq -e '.holmes.gateWarnings >= 1' >/dev/null
}

@test "cert-create --resume treats shared transform history as a fresh cert run" {
  create_schema
  create_realm_pass

  run node "$CLI_PATH" transform --schema schema.graphql --transmutation legacy-supabase --run-id run-cert-shared-123 --out-dir out --json --quiet
  assert_success

  run node "$CLI_PATH" cert-create --env test --json --transmutation legacy-supabase --run-id run-cert-shared-123 --resume
  assert_success
  echo "$output" | jq -e '.transmutation == "legacy-supabase"' >/dev/null
  echo "$output" | jq -e '.runId == "run-cert-shared-123"' >/dev/null
  echo "$output" | jq -e '.resumed == false' >/dev/null
  echo "$output" | jq -e '.shortCircuited == false' >/dev/null
  echo "$output" | jq -e '.run.command == "cert-create"' >/dev/null
  echo "$output" | jq -e '.run.status == "completed"' >/dev/null
}

@test "cert-create --resume completes a partial cert run without duplicating events" {
  create_realm_pass

  run env WESLEY_CRASH_AFTER_EVENT=2 node "$CLI_PATH" cert-create --env test --json --transmutation legacy-supabase --run-id run-cert-resume-123
  assert_failure 6

  run node "$CLI_PATH" cert-create --env test --json --transmutation legacy-supabase --run-id run-cert-resume-123 --resume
  assert_success
  echo "$output" | jq -e '.runId == "run-cert-resume-123"' >/dev/null
  echo "$output" | jq -e '.resumed == true' >/dev/null
  echo "$output" | jq -e '.shortCircuited == false' >/dev/null
  echo "$output" | jq -e '.run.status == "completed"' >/dev/null
  echo "$output" | jq -e '.events | map(.type) == ["RunRequested","SourcesResolved","CertificateIssued","RunCompleted"]' >/dev/null
}

@test "cert-create --resume short-circuits an already completed cert run" {
  create_realm_pass

  run node "$CLI_PATH" cert-create --env test --json --transmutation legacy-supabase --run-id run-cert-shortcircuit-123
  assert_success

  run node "$CLI_PATH" cert-create --env test --json --transmutation legacy-supabase --run-id run-cert-shortcircuit-123 --resume
  assert_success
  echo "$output" | jq -e '.result.resumed == true' >/dev/null
  echo "$output" | jq -e '.result.shortCircuited == true' >/dev/null
  echo "$output" | jq -e '.result.run.status == "completed"' >/dev/null
  echo "$output" | jq -e '.result.events | length == 4' >/dev/null
}

@test "cert create + sign + verify succeeds with PASS realm" {
  create_schema
  create_realm_pass
  # transform to produce artifacts
  run node "$CLI_PATH" transform --schema schema.graphql --out-dir out
  assert_success
  create_bundle_with_citation_quality

  # create SHIPME
  run node "$CLI_PATH" cert-create --env test --out .wesley-cache/SHIPME.md
  assert_success
  assert_file_exist .wesley-cache/SHIPME.md

  # if openssl missing, skip signing
  command -v openssl >/dev/null || skip "openssl not available"

  # generate keys
  openssl genpkey -algorithm ed25519 -out holmes.key >/dev/null 2>&1
  openssl pkey -in holmes.key -pubout -out holmes.pub >/dev/null 2>&1

  # sign
  run node "$CLI_PATH" cert-sign --in .wesley-cache/SHIPME.md --key holmes.key --signer HOLMES
  assert_success

  # verify
  run node "$CLI_PATH" cert-verify --in .wesley-cache/SHIPME.md --pub holmes.pub --json
  assert_success
  echo "$output" | jq -e '.ok == true' >/dev/null
  echo "$output" | jq -e '.evidence.coarse == 1' >/dev/null
  echo "$output" | jq -e '.evidence.trust == "weak"' >/dev/null
}

@test "cert-badge includes HOLMES verdict when present" {
  create_realm_pass
  create_holmes_summary_inputs

  run node "$CLI_PATH" cert-create --env test --out .wesley-cache/SHIPME.md
  assert_success

  run node "$CLI_PATH" cert-badge --in .wesley-cache/SHIPME.md
  assert_success
  [[ "$output" == *"[SHIPME] PASS"* ]]
  [[ "$output" == *"HOLMES REQUIRES INVESTIGATION"* ]]
}

@test "cert-verify fails when embedded counterfactual gate is fail" {
  create_schema
  create_realm_pass
  create_counterfactual_summary fail true

  run node "$CLI_PATH" transform --schema schema.graphql --out-dir out
  assert_success

  run node "$CLI_PATH" cert-create --env test --out .wesley-cache/SHIPME.md
  assert_success

  command -v openssl >/dev/null || skip "openssl not available"
  openssl genpkey -algorithm ed25519 -out holmes.key >/dev/null 2>&1
  openssl pkey -in holmes.key -pubout -out holmes.pub >/dev/null 2>&1

  run node "$CLI_PATH" cert-sign --in .wesley-cache/SHIPME.md --key holmes.key --signer HOLMES
  assert_success

  run node "$CLI_PATH" cert-verify --in .wesley-cache/SHIPME.md --pub holmes.pub --json
  assert_failure 5
  echo "$output" | jq -e 'select(has("counterfactualGate")) | .counterfactualGate == "fail"' >/dev/null
}
