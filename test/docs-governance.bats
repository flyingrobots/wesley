#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "design template does not scaffold live progress checklists" {
  run rg -n "^- \\[ \\]" docs/design/TEMPLATE.md
  assert_failure

  run rg -n "BEARING\\.md.*campaign status|campaign slice lands" docs/design/TEMPLATE.md
  assert_failure
}

@test "directive registry points at truth table instead of overstating support" {
  run rg -n "docs/DIRECTIVES\\.md" schemas/directives.graphql
  assert_success

  run rg -n "supported with deprecation warnings" schemas/directives.graphql
  assert_failure
}

@test "current-path example fixtures avoid experimental directive families" {
  run rg -n "@(uid|weight|critical|sensitive|pii|hasMany|hasOne|belongsTo|owner|grant|email|check|updatedAt|rpc|function)|@wes_(uid|weight|critical|sensitive|pii|hasMany|belongsTo|owner|grant|noRPC)|@@" \
    test/fixtures/examples/schema.graphql \
    test/fixtures/examples/schema-v2.graphql \
    test/fixtures/examples/ecommerce.graphql
  assert_failure
}
