#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "active filesystem planning directories are retired" {
  run test ! -e docs/drafts
  assert_success

  run test ! -e docs/plans
  assert_success

  run test ! -e docs/milestones
  assert_success
}

@test "README does not expose generated project progress state" {
  run rg -n "BEGIN:OVERALL_STATUS|END:OVERALL_STATUS|BEGIN:PACKAGE_MATRIX|END:PACKAGE_MATRIX|Package Matrix|Overall Project Status" README.md
  assert_failure
}

@test "repo-owned progress automation is absent" {
  run test ! -e .github/workflows/progress.yml
  assert_success

  run test ! -e scripts/compute-progress.mjs
  assert_success

  run test ! -e meta/progress.config.json
  assert_success

  run test ! -e meta/progress.json
  assert_success
}

@test "MVP planning evidence lives only under archive" {
  run test -e docs/archive/MVP/TechnicalArchitecture.md
  assert_success

  run rg -n "docs/milestones|milestones/MVP|MVP/TechnicalArchitecture\\.md" README.md docs/README.md docs/archive/MVP docs/design docs/architecture docs/guides docs/site
  assert_failure
}

@test "AGENTS is the only root agent guidance file" {
  run test -e AGENTS.md
  assert_success

  run test ! -e CLAUDE.md
  assert_success

  run test ! -e CODEX.md
  assert_success
}
