#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "design template does not scaffold live progress checklists" {
  run rg -n "^- \\[ \\]" docs/design/TEMPLATE.md
  assert_failure

  run rg -n "BEARING\\.md.*campaign status|campaign slice lands" docs/design/TEMPLATE.md
  assert_failure
}
