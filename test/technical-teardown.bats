#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

@test "technical teardown documents suppression blast radius" {
  run grep -F "Valid suppressions annotate every matching finding" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "first matching finding" docs/TECHNICAL_TEARDOWN.md
  assert_failure
}

@test "technical teardown is historical, not architecture authority" {
  run grep -F 'Status: historical `v0.2.0` release snapshot.' docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "retained here only as release archaeology" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "[ARCHITECTURE.md](./ARCHITECTURE.md)" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "[END_TO_END.md](./END_TO_END.md)" docs/TECHNICAL_TEARDOWN.md
  assert_success

  run grep -F "[BEARING.md](./BEARING.md)" docs/TECHNICAL_TEARDOWN.md
  assert_success
}

@test "historical technical teardown is excluded from release enforcement" {
  run grep -F "docs/TECHNICAL_TEARDOWN.md" .continuum/release.yml
  assert_failure

  run rg -n "check_technical_teardown_version|TECHNICAL_TEARDOWN version" xtask/src/main.rs
  assert_failure
}

@test "technical teardown does not carry stale pre-merge release blockers" {
  run grep -F "Release preparation is blocked only on the normal release branch" docs/TECHNICAL_TEARDOWN.md
  assert_failure

  run grep -F "release preparation has landed on synced \`main\`" docs/TECHNICAL_TEARDOWN.md
  assert_success
}
