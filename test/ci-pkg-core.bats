#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "pkg-core workflow quotes run step with @ token" {
  run bash -lc "awk '/@wesley\/core tests/{f=1} f && /run:/{print; exit}' .github/workflows/pkg-core.yml"
  assert_success
  # Expect run line contains surrounding double quotes
  [[ "$output" =~ run:\ \" ]]
}

