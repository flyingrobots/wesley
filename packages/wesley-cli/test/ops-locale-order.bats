#!/usr/bin/env bats

# Ensure ops discovery order is locale invariant

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TMP_ROOT="$(mktemp -d)"
  OPS_DIR="$TMP_ROOT/ops"
  mkdir -p "$OPS_DIR"
  CLI_BIN="$WESLEY_REPO_ROOT/packages/wesley-host-node/bin/wesley.mjs"
  SCHEMA_PATH="$WESLEY_REPO_ROOT/test/fixtures/examples/ecommerce.graphql"

  cat >"$OPS_DIR/Alpha.op.json" <<'JSON'
{
  "name": "Alpha",
  "table": "product",
  "columns": ["id", "name"],
  "filters": [
    { "column": "sku", "op": "ilike", "param": { "name": "sku", "type": "text" } }
  ],
  "orderBy": [ { "column": "sku", "dir": "asc" } ],
  "limit": 10
}
JSON

  cat >"$OPS_DIR/Éclair.op.json" <<'JSON'
{
  "name": "Éclair",
  "table": "product",
  "columns": ["id"],
  "filters": [
    { "column": "name", "op": "ilike", "param": { "name": "q", "type": "text" } }
  ],
  "orderBy": [ { "column": "name", "dir": "asc" } ],
  "limit": 5
}
JSON

  cat >"$OPS_DIR/zulu.op.json" <<'JSON'
{
  "name": "Zulu",
  "table": "product",
  "columns": ["id", "slug"],
  "orderBy": [ { "column": "slug", "dir": "desc" } ],
  "limit": 3
}
JSON

  OUT_A="$TMP_ROOT/out-a"
  OUT_B="$TMP_ROOT/out-b"
  LOG_A="$TMP_ROOT/run-a.log"
  LOG_B="$TMP_ROOT/run-b.log"
}

teardown() {
  rm -rf "$TMP_ROOT"
}

run_with_locale() {
  local locale="$1"
  local outdir="$2"
  local logfile="$3"

  rm -rf "$outdir"
  mkdir -p "$outdir"

  LC_ALL="$locale" LANG="$locale" NODE_ENV=production \
    node "$CLI_BIN" generate \
      --schema "$SCHEMA_PATH" \
      --ops "$OPS_DIR" \
      --out-dir "$outdir" \
      --allow-dirty >"$logfile" 2>&1
}

parse_order() {
  local logfile="$1"
  node -e '
    const fs = require("fs");
    const text = fs.readFileSync(process.argv[1], "utf8").replace(/\u001b\[[0-9;]*m/g, "");
    const matches = [...text.matchAll(/"sanitized":\s*"([^"]+)"/g)];
    const names = matches.map(match => match[1]);
    process.stdout.write(names.join(","));
  ' "$logfile"
}

@test "discovery order is locale invariant" {
  run_with_locale "C" "$OUT_A" "$LOG_A"
  local status=$?
  if [[ $status -ne 0 ]]; then
    cat "$LOG_A"
    fail "generate failed for locale C"
  fi

  run_with_locale "en_US.UTF-8" "$OUT_B" "$LOG_B"
  status=$?
  if [[ $status -ne 0 ]]; then
    cat "$LOG_B"
    fail "generate failed for locale en_US.UTF-8"
  fi

  order_a=$(parse_order "$LOG_A")
  order_b=$(parse_order "$LOG_B")

  assert_not_equal "$order_a" ""
  assert_equal "$order_a" "$order_b"
  # Expected order after sanitization & ASCII sort:
  # Alpha  → alpha
  # Éclair → eclair
  # Zulu   → zulu
  assert_equal "$order_a" "alpha,zulu,eclair"
}
