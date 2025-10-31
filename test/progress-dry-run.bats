#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "compute-progress supports --dry-run and prints summary" {
  run node scripts/compute-progress.mjs --dry-run
  assert_success
  assert_output --partial "[dry-run] meta/progress.json"
  assert_output --partial "[dry-run] meta/badges/overall.json"
  assert_output --partial "[dry-run] README.md would be updated between markers."
}

