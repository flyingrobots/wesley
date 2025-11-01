#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "runtime-smokes uses composite action to install bats (no raw apt-get)" {
  run bash -lc "grep -n 'apt-get install -y bats jq' .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -n "'uses: \./\.github/actions/install-bats'" .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  # One per job (deno, bun, node)
  [ "$output" -ge 1 ]
}
