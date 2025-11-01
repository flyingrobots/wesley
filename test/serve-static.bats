#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "serve-static maps .js to application/javascript" {
  run bash -lc "grep -n \"\\.js': 'application/javascript\" scripts/serve-static.mjs | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

@test "serve-static does not leak error messages to clients" {
  # Ensure the catch block does not end the response with raw error text
  run bash -lc "grep -n \"res.end(String(e?.message\" scripts/serve-static.mjs | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

