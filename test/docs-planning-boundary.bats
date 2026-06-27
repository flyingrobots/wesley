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

@test "reference docs own CLI and directive truth" {
  run test -e docs/reference/cli.md
  assert_success

  run test -e docs/reference/directives.md
  assert_success

  run test ! -e docs/DIRECTIVES.md
  assert_success

  run rg -n "docs/DIRECTIVES\\.md|DIRECTIVES\\.md|\\]\\((?:\\.\\.?/)*DIRECTIVES\\.md\\)" README.md docs test/fixtures --glob '*.md' --glob '*.graphql' --glob '!docs/method/graveyard/**'
  assert_failure
}

@test "stable example fixtures use canonical Wesley directives" {
  run rg -n "@(table|pk|primaryKey|fk|foreignKey|unique|index|tenant|default|rls|hasOne|hasMany|belongsTo)\\b" test/fixtures/examples/schema.graphql test/fixtures/examples/schema-v2.graphql test/fixtures/examples/ecommerce.graphql
  assert_failure
}

@test "Echo directive/spec docs are historical extraction context" {
  run test ! -e docs/guides/wes-join-directive.md
  assert_success

  run test ! -e docs/specs/echo-ir-v2.md
  assert_success

  run test -e docs/method/graveyard/EXTERNAL_wes-join-directive.md
  assert_success

  run test -e docs/method/graveyard/EXTERNAL_echo-ir-v2.md
  assert_success
}

@test "front-door signposts route task readers through docs topics" {
  run grep -F "[Topics](./docs/topics/README.md)" README.md
  assert_success

  run grep -F "[Topics](./topics/README.md)" docs/README.md
  assert_success

  run grep -F "[Docs Orientation](./topics/docs-orientation.md)" docs/README.md
  assert_success

  run grep -F "[Docs Orientation](./docs-orientation.md)" docs/topics/README.md
  assert_success
}

@test "active signposts do not advertise the retired 0.1.0 install command" {
  run rg -n "cargo install wesley-cli --version 0\\.1\\.0" README.md docs/GUIDE.md docs/ENTRYPOINTS.md CONTRIBUTING.md
  assert_failure
}

@test "HOLMES distribution favors tagged workflows over a GitHub App install path" {
  run grep -F "tagged reusable GitHub Actions" docs/topics/holmes-ci.md
  assert_success

  run grep -F "GitHub App the first-class HOLMES install path" docs/topics/holmes-ci.md
  assert_success

  run grep -F "GitHub App is not the first-class delivery mechanism" docs/architecture/holmes-integration.md
  assert_success

  run grep -F "Consumers should pin released tags, not \`main\`" docs/topics/holmes-ci.md
  assert_success
}
