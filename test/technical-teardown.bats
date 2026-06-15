#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "technical teardown documents suppression blast radius" {
  run grep -F "Valid suppressions annotate every matching finding" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "first matching finding" docs/TECHNICAL_TEARDOWN.md
  assert_failure
}
