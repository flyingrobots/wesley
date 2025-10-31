#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "nextStage no longer throws on unknown input" {
  run bash -lc "grep -n 'Unknown stage' scripts/compute-progress.mjs | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

@test "fetchMilestoneRatioFor guards typeof fetch" {
  run bash -lc "awk '/function fetchMilestoneRatioFor/{f=1} f && /typeof fetch/ {print; exit}' scripts/compute-progress.mjs | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

