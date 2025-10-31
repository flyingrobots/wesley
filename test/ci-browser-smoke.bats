#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "browser-smoke workflow drops pointless npm check and installs playwright via pnpm dlx" {
  run bash -lc "grep -n 'pnpm dlx playwright install --with-deps' .github/workflows/browser-smoke.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
  run bash -lc "grep -n 'npm -v' .github/workflows/browser-smoke.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

