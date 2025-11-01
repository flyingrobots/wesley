#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "host_contracts_browser logs diagnostics and exits non-zero on malformed OUT_JSON" {
  TMP=$(mktemp -d)
  OUT="$TMP/bad.json"
  echo '{invalid json' > "$OUT"
  run bash -lc "ONLY_PARSE_OUT_JSON=1 OUT_JSON='$OUT' node scripts/host_contracts_browser.mjs 2> '$TMP/err.log' > '$TMP/out.log'" 
  # Should exit non-zero due to parse error
  assert_failure
  # Stderr should include the parse failure message
  run bash -lc "cat '$TMP/err.log'"
  assert_output --partial "failed to parse OUT_JSON"
}

