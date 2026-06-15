#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "changelog records release governance hardening" {
  run grep -F "**Release governance hardening**" CHANGELOG.md
  assert_success
}
