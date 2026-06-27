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

@test "crates.io release procedure tags only synced origin main" {
  run grep -F 'Push `main`.' docs/CRATES_IO_RELEASE.md
  assert_failure

  run grep -F "Verify the release commit is already reachable from origin/main before" docs/CRATES_IO_RELEASE.md
  assert_success
}

@test "crates.io pre-tag gauntlet includes Rust dependency audit" {
  run grep -F "cargo audit" docs/CRATES_IO_RELEASE.md
  assert_success
}

@test "release checklist includes docs topics accuracy and coverage gate" {
  run grep -F 'docs/topics/' docs/governance/RELEASE_CHECKLIST.md
  assert_success

  run grep -F "90% accuracy" docs/governance/RELEASE_CHECKLIST.md
  assert_success

  run grep -F "90% coverage" docs/governance/RELEASE_CHECKLIST.md
  assert_success
}

@test "release profile names every published Wesley crate" {
  run test -f .continuum/release.yml
  assert_success

  for crate in wesley-core wesley-emit-codec wesley-emit-rust wesley-emit-typescript wesley-cli; do
    run grep -F "        - $crate" .continuum/release.yml
    assert_success

    run grep -F "name: $crate" .continuum/release.yml
    assert_success
  done
}

@test "release doctrine requires thesis scope and retrospective evidence" {
  run grep -F "No planned release without a thesis." docs/method/release.md
  assert_success

  run grep -F "must-ship, may-slip, and explicitly-not-included" docs/method/release.md
  assert_success

  run grep -F "retrospective and fallout issues" docs/method/release.md
  assert_success
}

@test "entrypoints command map lists Rust LE binary emitter" {
  run grep -F "wesley emit le-binary-rust --schema <path> --out <path>" docs/ENTRYPOINTS.md
  assert_success
}

@test "topics index uses exact docs authority paths" {
  run grep -nE '`docs/[^`]*\*[^`]*`' docs/topics/README.md
  assert_failure
}

@test "directives topic frames core directives as compatibility structure" {
  run grep -F 'Use canonical `@wes_*` directive names for new generic Wesley examples.' docs/topics/directives.md
  assert_failure

  run grep -F "Existing core directive names are compatibility structure, not domain ownership." docs/topics/directives.md
  assert_success
}
