#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

write_family_schema() {
    cat > family.graphql <<'EOF'
scalar Hash

enum AdmissionOutcomeKind {
  DERIVED
  PLURAL
}

type NeighborhoodParticipant {
  laneId: ID!
  stateHash: Hash!
}

type NeighborhoodCore {
  siteId: ID!
  outcomeKind: AdmissionOutcomeKind!
  participants: [NeighborhoodParticipant!]!
}

type Query {
  neighborhoodCores: [NeighborhoodCore!]!
}
EOF
}

@test "typescript emits family-aware interfaces for zero-table continuum schemas" {
    write_family_schema

    run node "$CLI_PATH" typescript --schema family.graphql --out-file out/family.types.generated.ts --json
    assert_success
    assert_file_exist out/family.types.generated.ts
    run grep -Fq "export interface NeighborhoodCore" out/family.types.generated.ts
    assert_success
    run grep -Fq 'export type AdmissionOutcomeKind = "DERIVED" | "PLURAL";' out/family.types.generated.ts
    assert_success
}

@test "zod emits family-aware schemas for zero-table continuum schemas" {
    write_family_schema

    run node "$CLI_PATH" zod --schema family.graphql --out-file out/family.zod.generated.ts --json
    assert_success
    assert_file_exist out/family.zod.generated.ts
    run grep -Fq "export const NeighborhoodCoreSchema = z.object(" out/family.zod.generated.ts
    assert_success
    run grep -Fq 'export const AdmissionOutcomeKindSchema = z.enum(["DERIVED", "PLURAL"]);' out/family.zod.generated.ts
    assert_success
}
