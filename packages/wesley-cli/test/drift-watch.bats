#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    CONTINUUM_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "drift-watch help works" {
    run node "$CLI_PATH" drift-watch --help
    assert_success
    assert_output --partial "Inspect local Continuum outputs and nearby mirrors for contract drift"
    assert_output --partial "--mirror-root"
    assert_output --partial "--report-out"
}

@test "drift-watch passes for coherent receipt-family mirrors" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p mirrors/consumer
    cp out/proof/warp-ttd/manifest/manifest.json mirrors/consumer/manifest.json
    cp out/proof/echo/mock/summary.json mirrors/consumer/summary.json
    cp out/proof/warp-ttd/typescript/registry.ts mirrors/consumer/registry.ts

    run node "$CLI_PATH" drift-watch \
        --scope receipt-family \
        --schema schema.graphql \
        --out-dir out/proof \
        --mirror-root mirrors/consumer \
        --json

    assert_success
    echo "$output" | jq -e '.success == true and .result.status == "pass" and .result.summary.failed == 0' >/dev/null
    echo "$output" | jq -e '.result.judgmentProfile.profilePackage == "@wesley/continuum" and .result.judgmentProfile.enginePackage == "@wesley/holmes"' >/dev/null
    echo "$output" | jq -e '.result.surfaces.mirrors[0].surfaceCount == 3 and (.result.failures.mirror | length == 0)' >/dev/null
}

@test "drift-watch fails when a mirror summary drifts from the authored schema hash" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p mirrors/drift
    cp out/proof/echo/mock/summary.json mirrors/drift/summary.json
    node - <<'NODE'
const fs = require('fs');
const path = 'mirrors/drift/summary.json';
const summary = JSON.parse(fs.readFileSync(path, 'utf8'));
summary.schemaHash = '0000000000000000000000000000000000000000000000000000000000000000';
fs.writeFileSync(path, JSON.stringify(summary, null, 2) + '\n');
NODE

    run node "$CLI_PATH" drift-watch \
        --scope receipt-family \
        --schema schema.graphql \
        --out-dir out/proof \
        --mirror-root mirrors/drift \
        --report-out out/proof/witness/drift-watch.json

    assert_failure
    assert_output --partial "Continuum drift watch failed"
    run jq -e '.checks[] | select(.id == "mirror.1.surface-1.hash-coherence" and .status == "fail")' out/proof/witness/drift-watch.json
    assert_success
}

@test "drift-watch fails when a mirror root exposes only unpinned contract declarations" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    node "$CLI_PATH" compile --schema schema.graphql --target warp-ttd,echo --out-dir out/proof >/dev/null

    mkdir -p mirrors/unpinned
    cat > mirrors/unpinned/protocol.ts <<'EOF'
export interface Receipt {
  receiptId: string;
}

export interface DeliveryObservation {
  observationId: string;
}
EOF

    run node "$CLI_PATH" drift-watch \
        --scope receipt-family \
        --schema schema.graphql \
        --out-dir out/proof \
        --mirror-root mirrors/unpinned \
        --report-out out/proof/witness/drift-watch.json

    assert_failure
    assert_output --partial "Continuum drift watch failed"
    run jq -e '.checks[] | select(.id == "mirror.1.provenance" and .status == "fail")' out/proof/witness/drift-watch.json
    assert_success
}
