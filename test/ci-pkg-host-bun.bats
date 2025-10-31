#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "pkg-host-bun has concurrency + timeout and pinned bun version" {
  run bash -lc "grep -n '^concurrency:' -n .github/workflows/pkg-host-bun.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
  run bash -lc "grep -n 'timeout-minutes:' .github/workflows/pkg-host-bun.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
  run bash -lc "grep -n 'bun-version: 1\\.' .github/workflows/pkg-host-bun.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

@test "runtime-smokes bun job pins bun version" {
  run bash -lc "grep -n 'bun-version: 1\\.' .github/workflows/runtime-smokes.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

