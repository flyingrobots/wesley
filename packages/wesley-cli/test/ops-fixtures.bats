#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  ROOT_DIR="${WESLEY_REPO_ROOT:-$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)}"
  CLI="$ROOT_DIR/packages/wesley-host-node/bin/wesley.mjs"
  OUT="$ROOT_DIR/out/examples-fixture-negative"
  rm -rf "$OUT"
}

teardown() {
  rm -rf "$OUT"
}

@test "ops fixture mismatch is an explicit negative case" {
  run node "$CLI" generate \
    --schema "$ROOT_DIR/test/fixtures/examples/schema.graphql" \
    --ops "$ROOT_DIR/test/fixtures/examples/ops-negative" \
    --out-dir "$OUT" \
    --allow-dirty

  assert_failure
  assert_output --partial "Cannot resolve root field 'products' to a known table type"
  assert_output --partial 'OPS_COMPILE_FAILED'
}
