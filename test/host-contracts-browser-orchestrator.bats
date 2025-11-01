#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "host_contracts_browser has a single srv.on('error') handler and buffers stderr" {
  run bash -lc "grep -n "'srv.on(\'error\''" scripts/host_contracts_browser.mjs | wc -l"
  assert_success
  [ "$output" -eq 1 ]
  run bash -lc "grep -n 'srv.stderr\?\.on' scripts/host_contracts_browser.mjs | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

