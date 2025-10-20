#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  cd "$BATS_TEST_DIRNAME/.."
}

@test "buildOutputPathMap applies defaults" {
  run node test/helpers/assert-output-paths.mjs defaults
  assert_success
}

@test "buildOutputPathMap respects overrides" {
  run node test/helpers/assert-output-paths.mjs overrides
  assert_success
}

@test "materializeArtifacts assigns resolved paths" {
  run node test/helpers/assert-output-paths.mjs materialize
  assert_success
}
