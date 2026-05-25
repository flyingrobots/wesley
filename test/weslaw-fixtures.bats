#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "weslaw substrate schema does not shadow accepted footprint law with inline directive law" {
  run grep -n '^[[:space:]]*@wes_footprint(' test/fixtures/weslaw/contract-bundle-shape.graphql
  assert_failure
}

@test "weslaw Law IR spec defines every referenced footprint nested shape" {
  run grep -F "Create-slot fields:" docs/design/0019-weslaw-semantic-law-ir/LAW_IR_V1.md
  assert_success

  run grep -F "Update fields:" docs/design/0019-weslaw-semantic-law-ir/LAW_IR_V1.md
  assert_success
}

@test "weslaw scalar examples use the closed forbidden-interpretation enum" {
  run grep -R "forbidSilentNarrowingToGraphQLInt" docs/design/0019-weslaw-semantic-law-ir test/fixtures/weslaw
  assert_failure
}

@test "weslaw explain command prose uses the planned CLI spelling" {
  run grep -R "explain-law" docs/design/0019-weslaw-semantic-law-ir
  assert_failure
}
