#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "deno_smoke.ts does not contain unused deno-lint-ignore-file" {
  run bash -lc "grep -n 'deno-lint-ignore-file no-explicit-any' -n scripts/deno_smoke.ts | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

