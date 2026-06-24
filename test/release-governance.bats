#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "changelog records release governance hardening" {
  run grep -F "**Release governance hardening**" CHANGELOG.md
  assert_success
}

@test "v0.1.0 TypeScript decode migration examples use bytes boundary" {
  run grep -F "decodeMakeWidget(reader)" docs/releases/v0.1.0.md
  assert_failure

  run grep -F "decodeMakeWidget(bytes)" docs/releases/v0.1.0.md
  assert_success
}
