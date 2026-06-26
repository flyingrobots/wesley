#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "Holmes README has no trailing spaces on Status line" {
  run bash -lc "grep -nE '^(Status: .*)  $' packages/wesley-holmes/README.md | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}
