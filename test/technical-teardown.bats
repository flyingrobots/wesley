#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "technical teardown documents suppression blast radius" {
  run grep -F "Valid suppressions annotate every matching finding" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "first matching finding" docs/TECHNICAL_TEARDOWN.md
  assert_failure
}

@test "technical teardown is release-scoped, not architecture authority" {
  run grep -F "Status: release-scoped orientation snapshot." docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "not the authoritative architecture map" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "[ARCHITECTURE.md](./ARCHITECTURE.md)" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "[BEARING.md](./BEARING.md)" docs/TECHNICAL_TEARDOWN.md
  assert_success
}

@test "technical teardown does not carry stale pre-merge release blockers" {
  run grep -F "Release preparation is blocked only on the normal release branch" docs/TECHNICAL_TEARDOWN.md
  assert_failure

  run grep -F "release preparation has landed on synced \`main\`" docs/TECHNICAL_TEARDOWN.md
  assert_success
}
