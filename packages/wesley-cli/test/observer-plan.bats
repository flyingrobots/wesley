#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-observer-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

write_observer_spec() {
    cat > worldline-snapshot.observer.mjs <<'EOF'
export function createWorldlineSnapshotObserverSpec() {
  return {
    observerName: 'worldlineSnapshot',
    kind: 'WORLDLINE_SNAPSHOT',
    operationName: 'worldlineSnapshot',
    aperture: {
      kind: 'CANONICAL_WORLDLINE_SLICE',
      historyWindow: 'CANONICAL_HEAD_ONLY',
      maxWorldlines: 1
    },
    basis: {
      kind: 'JEDIT_HOT_TEXT',
      nodeKinds: ['BufferWorldline', 'RopeHead', 'Checkpoint']
    },
    state: {
      mode: 'MEMORYLESS',
      schemaId: 'jedit.worldlineSnapshot.state.v1'
    },
    update: {
      kind: 'REPLACE_WITH_LATEST_SLICE'
    },
    emit: {
      kind: 'WORLDLINE_SNAPSHOT_READING',
      readingSchemaId: 'jedit.worldlineSnapshot.reading.v1'
    },
    budgets: {
      materialization: 'SLICE_ONLY',
      historyWindow: 'CANONICAL_HEAD_ONLY',
      maxWorldlines: 1
    },
    rights: {
      schemaId: 'jedit.worldlineSnapshot.rights.v1',
      exposureTier: 'AUTHOR_VISIBLE',
      revelationTier: 'CANONICAL_TEXT_ONLY',
      redactionPolicy: 'HIDE_NON_CANONICAL_LANES'
    }
  };
}
EOF
}

@test "observer-plan emits a generated observer plan from an authored observer spec module" {
    write_observer_spec

    run node "$CLI_PATH" observer-plan --spec worldline-snapshot.observer.mjs --export createWorldlineSnapshotObserverSpec --out-file out/worldlineSnapshot.observer-plan.generated.ts --json
    assert_success
    assert_file_exist out/worldlineSnapshot.observer-plan.generated.ts
    run grep -Fq "export interface ObserverPlan" out/worldlineSnapshot.observer-plan.generated.ts
    assert_success
    run grep -Fq '"observerName": "worldlineSnapshot"' out/worldlineSnapshot.observer-plan.generated.ts
    assert_success
    run grep -Fq '"kind": "WORLDLINE_SNAPSHOT"' out/worldlineSnapshot.observer-plan.generated.ts
    assert_success
    run grep -Fq '"specPath": "worldline-snapshot.observer.mjs"' out/worldlineSnapshot.observer-plan.generated.ts
    assert_success
}
