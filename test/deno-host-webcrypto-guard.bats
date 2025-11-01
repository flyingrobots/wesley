#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "deno host sha256Hex guards crypto.subtle" {
  run bash -lc "grep -n 'crypto.*subtle' packages/wesley-host-deno/mod.ts | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

