#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "host-node README has no trailing spaces on Status line" {
  run bash -lc "grep -nE '^(Status: .*)  $' packages/wesley-host-node/README.md | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

@test "slaps README has no trailing spaces on Status line" {
  run bash -lc "grep -nE '^(Status: .*)  $' packages/wesley-slaps/README.md | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

