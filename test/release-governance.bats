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

@test "method release runbook syncs protected main before tag guard" {
  run grep -F "git push origin main vX.Y.Z" docs/method/release-runbook.md
  assert_failure

  run grep -F "Sync local main to origin/main after the release commit has landed" docs/method/release-runbook.md
  assert_success
}
