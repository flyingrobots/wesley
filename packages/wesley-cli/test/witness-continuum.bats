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
    RECEIPT_FIXTURE_DIR="$REPO_ROOT/test/fixtures/continuum/receipt-family"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

generate_local_inspect_surfaces() {
    node "$CLI_PATH" compile-ttd --schema "$TTD_SCHEMA" --out-dir out/ttd >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$ECHO_SCHEMA" --out-dir out/echo >/dev/null
}

generate_receipt_family_surfaces() {
    node "$CLI_PATH" compile-ttd --schema "$RECEIPT_SCHEMA" --out-dir out/receipt-family/ttd >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$RECEIPT_SCHEMA" --out-dir out/receipt-family/echo >/dev/null
}

generate_settlement_family_surfaces() {
    node "$CLI_PATH" compile-ttd --schema "$SETTLEMENT_SCHEMA" --out-dir out/settlement-family/ttd >/dev/null
    node "$CLI_PATH" bundle-echo --schema "$SETTLEMENT_SCHEMA" --out-dir out/settlement-family/echo >/dev/null
}

run_witness_continuum() {
    run node "$CLI_PATH" witness-continuum \
        --ttd-schema "$TTD_SCHEMA" \
        --echo-schema "$ECHO_SCHEMA" \
        "$@"
}

@test "witness-continuum help works" {
    run node "$CLI_PATH" witness-continuum --help
    assert_success
    assert_output --partial 'Compatibility alias for "wesley witness"'
    assert_output --partial "--schema"
    assert_output --partial "--out-dir"
    assert_output --partial "--report-out"
    assert_output --partial "--scope"
    assert_output --partial "--ttd-schema"
    assert_output --partial "--echo-dir"
}

@test "witness-continuum accepts the root-oriented receipt-family interface" {
    node "$CLI_PATH" compile --schema "$RECEIPT_SCHEMA" --target warp-ttd,echo --out-dir out/proof >/dev/null

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --schema "$RECEIPT_SCHEMA" \
        --out-dir out/proof \
        --json
    assert_success
    echo "$output" | jq -e '.result.scope == "receipt-family"' >/dev/null
    echo "$output" | jq -e '.result.outputPath == "out/proof/witness/conformance.json"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
}

@test "witness-continuum writes a passing conformance report" {
    generate_local_inspect_surfaces

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    echo "$output" | jq -e '.result.scope == "current-minimum-shared-surface"' >/dev/null
    echo "$output" | jq -e '.result.judgmentProfile.profilePackage == "@wesley/continuum" and .result.judgmentProfile.enginePackage == "@wesley/holmes"' >/dev/null
    echo "$output" | jq -e '.result.summary.failed == 0' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "continuum.delivery-vs-receipt-separation" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "publication-boundary.ttd-protocol" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "publication-boundary.echo-core-types" and .status == "pass")' >/dev/null
    assert_file_exist out/witness/conformance.json
}

@test "witness-continuum fails when mocked deliveries drift from summary" {
    generate_local_inspect_surfaces

    jq '.mock.observationCount = 99' out/echo/mock/summary.json > out/echo/mock/summary.tmp
    mv out/echo/mock/summary.tmp out/echo/mock/summary.json

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    assert_output --partial "Continuum witness failed"
    assert_file_exist out/witness/conformance.json
    run jq -e '.status == "fail" and .summary.failed > 0' out/witness/conformance.json
    assert_success
    run jq -e '.checks[] | select(.id == "echo.mock-deliveries-summary" and .status == "fail")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum fails when mocked deliveries lose required observation fields" {
    generate_local_inspect_surfaces

    node - <<'EOF'
const fs = require('fs');
const rows = fs.readFileSync('out/echo/mock/deliveries.jsonl', 'utf8')
  .trim()
  .split('\n')
  .map(JSON.parse)
  .map((row) => ({
    envelope: row.envelope,
    data: {
      outcome: row.data.outcome
    }
  }));
fs.writeFileSync('out/echo/mock/deliveries.jsonl', rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
EOF

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.checks[] | select(.id == "echo.mock-deliveries-shape" and .status == "fail")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum fails when Echo summary drops canonical schema origin" {
    generate_local_inspect_surfaces

    jq 'del(.canonicalSchemaPath) | .schemaPath = "-"' out/echo/mock/summary.json > out/echo/mock/summary.tmp
    mv out/echo/mock/summary.tmp out/echo/mock/summary.json

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.checks[] | select(.id == "echo.summary-traceability" and .status == "fail")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum fails when Echo IR hash drifts" {
    generate_local_inspect_surfaces

    jq '.schema_hash = "0000000000000000000000000000000000000000000000000000000000000000" | .schema_sha256 = "0000000000000000000000000000000000000000000000000000000000000000"' out/echo/ir.json > out/echo/ir.tmp
    mv out/echo/ir.tmp out/echo/ir.json

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.checks[] | select(.id == "echo.ir-traceability" and .status == "fail")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum accepts slash-heavy surface directories" {
    generate_local_inspect_surfaces

    run_witness_continuum \
        --ttd-dir "out/ttd///" \
        --echo-dir "out/echo///" \
        --out out/witness/conformance.json \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    assert_file_exist out/witness/conformance.json
}

@test "witness-continuum accepts mixed relative and absolute schema paths for the same Echo schema" {
    cd "$REPO_ROOT"
    node "$CLI_PATH" compile-ttd --schema schemas/ttd-protocol.graphql --out-dir "$TEST_TEMP_DIR/out/ttd" >/dev/null
    node "$CLI_PATH" bundle-echo --schema schemas/echo-core-types.graphql --out-dir "$TEST_TEMP_DIR/out/echo" >/dev/null
    cd "$TEST_TEMP_DIR"

    run_witness_continuum \
        --ttd-dir "$TEST_TEMP_DIR/out/ttd" \
        --echo-dir "$TEST_TEMP_DIR/out/echo" \
        --out "$TEST_TEMP_DIR/out/witness/conformance.json" \
        --json
    assert_success
    echo "$output" | jq -e '.result.checks[] | select(.id == "echo.summary-traceability" and .status == "pass")' >/dev/null
}

@test "witness-continuum reports missing slash-heavy directories cleanly" {
    run_witness_continuum \
        --ttd-dir "out/ttd///" \
        --echo-dir "out/echo///" \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.surfaces.ttd.missingFiles | index("manifest/schema.json")' out/witness/conformance.json
    assert_success
    run jq -e '.surfaces.echo.missingFiles | index("mock/summary.json")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum reports malformed JSONL line numbers" {
    generate_local_inspect_surfaces

    printf '%s\n%s\n' '{"envelope":"DeliveryObservationSummary","data":{"outcome":"delivered"}}' '{' > out/echo/mock/deliveries.jsonl

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    assert_output --partial "JSONL parse error at line 2"
}

@test "witness-continuum dry-run failure does not point at a report file that was not written" {
    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json \
        --dry-run
    assert_failure
    refute_output --partial "See out/witness/conformance.json"
    assert_file_not_exist out/witness/conformance.json
}

@test "witness-continuum fails when current-minimum families gain a handwritten shadow contract" {
    generate_local_inspect_surfaces

    mkdir -p shadow
    cat > shadow/cursor-shadow.graphql <<'EOF'
type CursorState {
  fake: String
}
EOF

    run_witness_continuum \
        --ttd-dir out/ttd \
        --echo-dir out/echo \
        --out out/witness/conformance.json
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.ttd-protocol" and .status == "fail")' out/witness/conformance.json
    assert_success
}

@test "witness-continuum writes a passing receipt-family conformance report" {
    generate_receipt_family_surfaces

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --ttd-schema "$RECEIPT_SCHEMA" \
        --echo-schema "$RECEIPT_SCHEMA" \
        --ttd-dir out/receipt-family/ttd \
        --echo-dir out/receipt-family/echo \
        --out out/witness/receipt-family.json \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.scope == "receipt-family"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    echo "$output" | jq -e '.result.summary.failed == 0' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "receipt-family.ttd-fixture-shape" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "receipt-family.boundary-fixture" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "receipt-family.roundtrip-fixture-vectors" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "receipt-family.receipt-vs-witness-separation" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "publication-boundary.receipt-family" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.surfaces.publicationBoundary.rules[] | select(.id == "receipt-family") | .declaredCompatMirrors | length >= 1' >/dev/null
    assert_file_exist out/witness/receipt-family.json
}

@test "witness-continuum receipt-family fails when TTD footprints drift from fixture" {
    generate_receipt_family_surfaces

    jq '.footprints |= map(if .opName == "witnesses" then .reads = ["Receipt"] else . end)' \
        out/receipt-family/ttd/manifest/contracts.json > out/receipt-family/ttd/manifest/contracts.tmp
    mv out/receipt-family/ttd/manifest/contracts.tmp out/receipt-family/ttd/manifest/contracts.json

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --ttd-schema "$RECEIPT_SCHEMA" \
        --echo-schema "$RECEIPT_SCHEMA" \
        --ttd-dir out/receipt-family/ttd \
        --echo-dir out/receipt-family/echo \
        --out out/witness/receipt-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "receipt-family.ttd-fixture-shape" and .status == "fail")' out/witness/receipt-family.json
    assert_success
}

@test "witness-continuum receipt-family fails when Echo op vectors drift from the roundtrip fixture" {
    generate_receipt_family_surfaces

    jq '(.ops[] | select(.name == "witnesses") | .result_type) = "Receipt"' \
        out/receipt-family/echo/ir.json > out/receipt-family/echo/ir.tmp
    mv out/receipt-family/echo/ir.tmp out/receipt-family/echo/ir.json

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --ttd-schema "$RECEIPT_SCHEMA" \
        --echo-schema "$RECEIPT_SCHEMA" \
        --ttd-dir out/receipt-family/ttd \
        --echo-dir out/receipt-family/echo \
        --out out/witness/receipt-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "receipt-family.roundtrip-fixture-vectors" and .status == "fail")' out/witness/receipt-family.json
    assert_success
}

@test "witness-continuum receipt-family fails when delivery rows absorb receipt or witness residue" {
    generate_receipt_family_surfaces

    INVALID_FIXTURE="$RECEIPT_FIXTURE_DIR/invalid.json" node - <<'EOF'
const fs = require('fs');
const invalid = JSON.parse(fs.readFileSync(process.env.INVALID_FIXTURE, 'utf8')).malformedDeliveryObservationRow;
const path = 'out/receipt-family/echo/mock/deliveries.jsonl';
const rows = fs.readFileSync(path, 'utf8').trim().split('\n');
rows[0] = JSON.stringify(invalid);
fs.writeFileSync(path, rows.join('\n') + '\n');
EOF

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --ttd-schema "$RECEIPT_SCHEMA" \
        --echo-schema "$RECEIPT_SCHEMA" \
        --ttd-dir out/receipt-family/ttd \
        --echo-dir out/receipt-family/echo \
        --out out/witness/receipt-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "receipt-family.receipt-vs-witness-separation" and .status == "fail")' out/witness/receipt-family.json
    assert_success
}

@test "witness-continuum receipt-family fails when a leaked generated artifact escapes its reserved roots" {
    generate_receipt_family_surfaces

    mkdir -p leak
    cat > leak/ops.generated.ts <<'EOF'
export interface Receipt {
  receiptId: string;
}
EOF

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --ttd-schema "$RECEIPT_SCHEMA" \
        --echo-schema "$RECEIPT_SCHEMA" \
        --ttd-dir out/receipt-family/ttd \
        --echo-dir out/receipt-family/echo \
        --out out/witness/receipt-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.receipt-family" and .status == "fail")' out/witness/receipt-family.json
    assert_success
}

@test "witness-continuum receipt-family fails when a handwritten scalar shadow escapes the authored home" {
    generate_receipt_family_surfaces

    mkdir -p shadow
    cat > shadow/hash-shadow.graphql <<'EOF'
scalar Hash
EOF

    run node "$CLI_PATH" witness-continuum \
        --scope receipt-family \
        --ttd-schema "$RECEIPT_SCHEMA" \
        --echo-schema "$RECEIPT_SCHEMA" \
        --ttd-dir out/receipt-family/ttd \
        --echo-dir out/receipt-family/echo \
        --out out/witness/receipt-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.receipt-family" and .status == "fail")' out/witness/receipt-family.json
    assert_success
}

@test "witness-continuum writes a passing settlement-family conformance report" {
    generate_settlement_family_surfaces

    run node "$CLI_PATH" witness-continuum \
        --scope settlement-family \
        --ttd-schema "$SETTLEMENT_SCHEMA" \
        --echo-schema "$SETTLEMENT_SCHEMA" \
        --ttd-dir out/settlement-family/ttd \
        --echo-dir out/settlement-family/echo \
        --out out/witness/settlement-family.json \
        --json
    assert_success
    echo "$output" | jq -e '.success == true' >/dev/null
    echo "$output" | jq -e '.result.scope == "settlement-family"' >/dev/null
    echo "$output" | jq -e '.result.status == "pass"' >/dev/null
    echo "$output" | jq -e '.result.summary.failed == 0' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "settlement-family.ttd-fixture-shape" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "settlement-family.boundary-fixture" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "settlement-family.decision-separation" and .status == "pass")' >/dev/null
    echo "$output" | jq -e '.result.checks[] | select(.id == "publication-boundary.settlement-family" and .status == "pass")' >/dev/null
    assert_file_exist out/witness/settlement-family.json
}

@test "witness-continuum settlement-family fails when TTD footprints drift from fixture" {
    generate_settlement_family_surfaces

    jq '.footprints |= map(if .opName == "settleLane" then .writes = ["SettlementResult"] else . end)' \
        out/settlement-family/ttd/manifest/contracts.json > out/settlement-family/ttd/manifest/contracts.tmp
    mv out/settlement-family/ttd/manifest/contracts.tmp out/settlement-family/ttd/manifest/contracts.json

    run node "$CLI_PATH" witness-continuum \
        --scope settlement-family \
        --ttd-schema "$SETTLEMENT_SCHEMA" \
        --echo-schema "$SETTLEMENT_SCHEMA" \
        --ttd-dir out/settlement-family/ttd \
        --echo-dir out/settlement-family/echo \
        --out out/witness/settlement-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "settlement-family.ttd-fixture-shape" and .status == "fail")' out/witness/settlement-family.json
    assert_success
}

@test "witness-continuum settlement-family fails when import and conflict boundaries blur" {
    generate_settlement_family_surfaces

    jq '(.types[] | select(.name == "ImportCandidate") | .fields) += [{"name":"reason","type":"ConflictReason","required":true}]' \
        out/settlement-family/ttd/manifest/schema.json > out/settlement-family/ttd/manifest/schema.tmp
    mv out/settlement-family/ttd/manifest/schema.tmp out/settlement-family/ttd/manifest/schema.json

    run node "$CLI_PATH" witness-continuum \
        --scope settlement-family \
        --ttd-schema "$SETTLEMENT_SCHEMA" \
        --echo-schema "$SETTLEMENT_SCHEMA" \
        --ttd-dir out/settlement-family/ttd \
        --echo-dir out/settlement-family/echo \
        --out out/witness/settlement-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "settlement-family.decision-separation" and .status == "fail")' out/witness/settlement-family.json
    assert_success
}

@test "witness-continuum settlement-family fails when a handwritten scalar shadow escapes the authored home" {
    generate_settlement_family_surfaces

    mkdir -p shadow
    cat > shadow/hash-shadow.graphql <<'EOF'
scalar Hash
EOF

    run node "$CLI_PATH" witness-continuum \
        --scope settlement-family \
        --ttd-schema "$SETTLEMENT_SCHEMA" \
        --echo-schema "$SETTLEMENT_SCHEMA" \
        --ttd-dir out/settlement-family/ttd \
        --echo-dir out/settlement-family/echo \
        --out out/witness/settlement-family.json
    assert_failure
    run jq -e '.checks[] | select(.id == "publication-boundary.settlement-family" and .status == "fail")' out/witness/settlement-family.json
    assert_success
}
