#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "host-contracts sha256Hex guards crypto.subtle" {
  run bash -lc "grep -n \"crypto?.subtle\|crypto && crypto.subtle\" test/contracts/host-contracts.mjs | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

