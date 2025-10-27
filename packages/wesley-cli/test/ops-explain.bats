#!/usr/bin/env bats

load bats-assert
load bats-file

setup() {
  ROOT_DIR="$(git rev-parse --show-toplevel)"
  CLI="$ROOT_DIR/packages/wesley-host-node/bin/wesley.mjs"
  OUT="$ROOT_DIR/out/examples"
  rm -rf "$OUT"
}

@test "ops: emits mock EXPLAIN JSON snapshots with --ops-explain mock" {
  run node "$CLI" generate \
    --schema "$ROOT_DIR/test/fixtures/examples/ecommerce.graphql" \
    --out-dir "$OUT" \
    --ops "$ROOT_DIR/test/fixtures/examples/ops" \
    --ops-explain mock \
    --ops-allow-errors \
    --allow-dirty

  assert_success

  REG="$OUT/ops/registry.json"
  EXPL="$OUT/ops/explain/products_by_name.explain.json"

  assert_file_exists "$REG"
  assert_file_exists "$EXPL"

  run jq -e '.Plan | type == "object" and (."Node Type" != null)' "$EXPL"
  assert_success
}

