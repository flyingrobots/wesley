#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

# Oracle: the field values cert-shipme.yml and the Holmes commands read from
# these files. The output is parsed, so a value under the wrong object, or
# malformed JSON, fails.

default_commit="abcdef1234567890abcdef1234567890abcdef12"

@test "shipme certificate fixture prepares PASS realm and exact evidence" {
  tmp_dir="$(mktemp -d -t wesley-shipme-fixture-XXXXXX)"
  # The script stamps GITHUB_SHA into the fixture when it is set, and every
  # GitHub runner sets it. Unset it here so the default commit is what is tested.
  run bash -c "cd '$tmp_dir' && env -u GITHUB_SHA node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' >/dev/null && node '$PWD/test/bin/assert-shipme-fixture.mjs' .wesley-cache '$default_commit'"
  rm -rf "$tmp_dir"
  assert_success
  assert_output --partial "checked 9 fields"
}

@test "shipme certificate fixture stamps the workflow's commit when GITHUB_SHA is set" {
  # cert-shipme certifies the landed commit, so the fixture must carry it.
  commit="1111111111111111111111111111111111111111"
  tmp_dir="$(mktemp -d -t wesley-shipme-fixture-XXXXXX)"
  run bash -c "cd '$tmp_dir' && GITHUB_SHA='$commit' node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' >/dev/null && node '$PWD/test/bin/assert-shipme-fixture.mjs' .wesley-cache '$commit'"
  rm -rf "$tmp_dir"
  assert_success
  assert_output --partial "for commit $commit"
}

@test "the fixture check refuses a scores file whose metadata is null" {
  # Shows the assertion can fail: `typeof null` is "object" in JavaScript.
  tmp_dir="$(mktemp -d -t wesley-shipme-fixture-XXXXXX)"
  run bash -c "cd '$tmp_dir' && env -u GITHUB_SHA node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' >/dev/null && node -e 'const fs = require(\"node:fs\"); const p = \".wesley-cache/scores.json\"; const s = JSON.parse(fs.readFileSync(p, \"utf8\")); s.metadata = null; fs.writeFileSync(p, JSON.stringify(s));' && node '$PWD/test/bin/assert-shipme-fixture.mjs' .wesley-cache '$default_commit'"
  rm -rf "$tmp_dir"
  assert_failure
  assert_output --partial 'scores.metadata'
}
