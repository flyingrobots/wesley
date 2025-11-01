#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "browser contracts main: verifyIr returns structured diagnostics and no inner try/catch" {
  run bash -lc "grep -n 'function verifyIr' test/browser/contracts/main.js | wc -l"
  assert_success
  [ "$output" -ge 1 ]
  run bash -lc "grep -n '{ ok: errors.length === 0' test/browser/contracts/main.js | wc -l"
  assert_success
  [ "$output" -ge 1 ]
  run bash -lc "grep -n 'try {' test/browser/contracts/main.js | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

