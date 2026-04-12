#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)"
    TTD_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/ttd-protocol.graphql"
    ECHO_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/echo-core-types.graphql"
    RECEIPT_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
    SETTLEMENT_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-settlement-family.graphql"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "witness help works" {
    run node "$CLI_PATH" witness --help
    assert_success
    assert_output --partial "Verify generated contract legs against one shared Continuum witness scope"
    assert_output --partial "--schema"
    assert_output --partial "--out-dir"
    assert_output --partial "--report-out"
}

@test "witness verifies a receipt-family output root compiled from one shared schema" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.kind == "wesley.continuum.conformance.v1"' >/dev/null
    echo "$output" | jq -e '.result.scope == "receipt-family"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/proof/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/proof/witness/conformance.json
}

@test "witness passes from the Wesley repo root against an external Continuum-authored receipt family" {
    PROOF_ROOT="$TEST_TEMP_DIR/out/root-proof"
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir "$PROOF_ROOT" >/dev/null

    run bash -c "cd '$REPO_ROOT' && node '$CLI_PATH' witness --scope receipt-family --schema '$RECEIPT_SCHEMA' --out-dir '$PROOF_ROOT' --json"
    assert_success
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness ignores unrelated generated-looking artifacts under ignored cache and output directories" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p .wesley-cache/continuum/external-proof/warp-ttd/typescript out/echo
    cat > .wesley-cache/continuum/external-proof/warp-ttd/typescript/types.ts <<'EOF'
export interface Receipt {
  receiptId: string;
}
EOF
    cat > out/echo/ops.generated.ts <<'EOF'
export interface Receipt {
  receiptId: string;
}
EOF

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof \
        --json
    assert_success
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness ignores unrelated manifest.json files outside generated roots" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p docs
    cat > docs/manifest.json <<'EOF'
{
  "family": "Hash",
  "note": "Receipt family design notes, not generated output."
}
EOF

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof \
        --json
    assert_success
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness accepts copied leg overrides alongside a root realization manifest" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/original >/dev/null

    mkdir -p out/copied
    cp -R out/original/warp-ttd out/copied/ttd
    cp -R out/original/echo out/copied/echo

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/original \
        --ttd-dir out/copied/ttd \
        --echo-dir out/copied/echo \
        --json
    assert_success
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness accepts warp-ttd roots compiled with manifest and rust emits only" {
    node "$CLI_PATH" compile \
        --schema "$RECEIPT_SCHEMA" \
        --target warp-ttd,echo \
        --emit manifest,rust \
        --out-dir out/proof >/dev/null

    assert_file_exist out/proof/warp-ttd/manifest/schema.json
    assert_file_exist out/proof/warp-ttd/rust/README.md
    assert_file_not_exist out/proof/warp-ttd/typescript/types.ts

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof \
        --json
    assert_success
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness verifies current-minimum outputs from one root with per-leg schema overrides" {
    node "$CLI_PATH" compile-ttd --schema "$TTD_SCHEMA" --out-dir out/current/warp-ttd >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir out/current/echo >/dev/null

    run node "$CLI_PATH" witness \
        --scope current-minimum-shared-surface \
        --ttd-schema "$TTD_SCHEMA" \
        --echo-schema "$ECHO_SCHEMA" \
        --out-dir out/current \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.scope == "current-minimum-shared-surface"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/current/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/current/witness/conformance.json
}

@test "witness passes from the Wesley repo root for the current minimum surface" {
    PROOF_ROOT="$TEST_TEMP_DIR/out/current-root"
    node "$CLI_PATH" compile-ttd --schema "$TTD_SCHEMA" --out-dir "$PROOF_ROOT/warp-ttd" >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir "$PROOF_ROOT/echo" >/dev/null

    run bash -c "cd '$REPO_ROOT' && node '$CLI_PATH' witness --scope current-minimum-shared-surface --ttd-schema '$TTD_SCHEMA' --echo-schema '$ECHO_SCHEMA' --out-dir '$PROOF_ROOT' --json"
    assert_success
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness verifies a settlement-family output root compiled from one shared schema" {
    node "$CLI_PATH" compile --schema "$SETTLEMENT_SCHEMA" --target warp-ttd,echo --out-dir out/settlement >/dev/null

    run node "$CLI_PATH" witness \
        --scope settlement-family \
        --schema "$SETTLEMENT_SCHEMA" \
        --out-dir out/settlement \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.scope == "settlement-family"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/settlement/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/settlement/witness/conformance.json
}

@test "witness records a failing report when the authored schema is malformed" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p authored
    cat > authored/bad-receipt.graphql <<'EOF'
type Receipt {
  receiptId: ID!
EOF

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema authored/bad-receipt.graphql \
        --out-dir out/proof
    assert_failure
    assert_file_exist out/proof/witness/conformance.json
    run jq -e '.checks[] | select(.id == "publication-boundary.receipt-family" and .status == "fail")' out/proof/witness/conformance.json
    assert_success
    run jq -e '.surfaces.publicationBoundary.rules[] | select(.id == "receipt-family") | .schemaParseFailures | length > 0' out/proof/witness/conformance.json
    assert_success
}

@test "witness fails when receipt-family gains a handwritten scalar shadow contract" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p shadow
    cat > shadow/hash-shadow.graphql <<'EOF'
scalar Hash
EOF

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.receipt-family" and .status == "fail")' out/proof/witness/conformance.json
    assert_success
}

@test "witness fails when receipt-family gains a handwritten scalar shadow contract under tests" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p tests/rogue
    cat > tests/rogue/hash-shadow.graphql <<'EOF'
scalar Hash
EOF

    run node "$CLI_PATH" witness \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.receipt-family" and .status == "fail")' out/proof/witness/conformance.json
    assert_success
}

@test "witness fails when settlement-family gains a handwritten scalar shadow contract" {
    node "$CLI_PATH" compile --schema "$SETTLEMENT_SCHEMA" --target warp-ttd,echo --out-dir out/settlement >/dev/null

    mkdir -p shadow
    cat > shadow/hash-shadow.graphql <<'EOF'
scalar Hash
EOF

    run node "$CLI_PATH" witness \
        --scope settlement-family \
        --schema "$SETTLEMENT_SCHEMA" \
        --out-dir out/settlement
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.settlement-family" and .status == "fail")' out/settlement/witness/conformance.json
    assert_success
}
