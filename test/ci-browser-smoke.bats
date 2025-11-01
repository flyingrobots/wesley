#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "browser-smoke workflow installs browsers via workspace runner (pnpm exec) and has no npm check" {
  run bash -lc "grep -n 'pnpm exec playwright install chromium' .github/workflows/browser-smoke.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
  run bash -lc "grep -n 'pnpm dlx playwright install' .github/workflows/browser-smoke.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]
  run bash -lc "grep -n 'npm -v' .github/workflows/browser-smoke.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}
