#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TMP_ROOT="$(mktemp -d)"
  OPS_DIR="$TMP_ROOT/ops"
  mkdir -p "$OPS_DIR"

  cat >"$OPS_DIR/products.op.json" <<'JSON'
{
  "name": "products",
  "table": "product",
  "columns": ["id", "name"],
  "orderBy": [ { "column": "name", "dir": "asc" } ]
}
JSON

  OUT_DIR="$TMP_ROOT/out"
}

teardown() {
  rm -rf "$TMP_ROOT"
}

run_cli() {
  local extra_flags=("$@")
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  CI=true NODE_ENV=production \
    node ../wesley-host-node/bin/wesley.mjs generate \
      --schema ../example/ecommerce.graphql \
      --ops "$OPS_DIR" \
      --out-dir "$OUT_DIR" \
      --allow-dirty \
      "${extra_flags[@]}" 2>&1
}

@test "--ops-allow-errors fails in CI without override" {
  run run_cli --ops-allow-errors
  assert_failure
  assert_output --partial "--ops-allow-errors is disabled when CI=true"
}

@test "--ops-allow-errors succeeds in CI with override" {
  run run_cli --ops-allow-errors --i-know-what-im-doing --quiet
  assert_success
}
