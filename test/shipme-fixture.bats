#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

@test "shipme certificate fixture prepares PASS realm and exact evidence" {
  tmp_dir="$(mktemp -d -t wesley-shipme-fixture-XXXXXX)"
  # The script stamps GITHUB_SHA into the fixture when it is set, and every
  # GitHub runner sets it. Unset it here so the default commit is what is tested.
  run bash -lc "cd '$tmp_dir' && env -u GITHUB_SHA node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' && grep -F '\"verdict\": \"PASS\"' .wesley-cache/realm.json && grep -F '\"version\": \"2.0.0\"' .wesley-cache/scores.json && grep -F '\"commit\": \"abcdef1234567890abcdef1234567890abcdef12\"' .wesley-cache/scores.json && grep -F '\"metadata\"' .wesley-cache/scores.json && grep -F '\"readiness\"' .wesley-cache/bundle.json && grep -F '\"lines\": \"1-2\"' .wesley-cache/bundle.json && grep -F '\"lines\": \"1-1\"' .wesley-cache/bundle.json"
  rm -rf "$tmp_dir"
  assert_success
}

@test "shipme certificate fixture stamps the workflow's commit when GITHUB_SHA is set" {
  # cert-shipme certifies the landed commit, so the fixture must carry it.
  tmp_dir="$(mktemp -d -t wesley-shipme-fixture-XXXXXX)"
  run bash -lc "cd '$tmp_dir' && GITHUB_SHA=1111111111111111111111111111111111111111 node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' && grep -F '\"commit\": \"1111111111111111111111111111111111111111\"' .wesley-cache/scores.json"
  rm -rf "$tmp_dir"
  assert_success
}
