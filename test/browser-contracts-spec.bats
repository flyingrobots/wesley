#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "contracts spec uses OUT_JSON var consistently" {
  run bash -lc "grep -n \"const OUT_JSON = process.env.OUT_JSON\" test/browser/contracts/host-contracts.spec.mjs | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

@test "contracts spec documents orchestration and URL" {
  run bash -lc "grep -n \"scripts/host_contracts_browser.mjs\|127.0.0.1:8787\" test/browser/contracts/host-contracts.spec.mjs | wc -l"
  assert_success
  [ "$output" -ge 2 ]
}

@test "contracts spec asserts res presence and failed === 0 explicitly" {
  run bash -lc "grep -n \"expect(res).toBeTruthy()\|expect(res.failed).toBe(0)\" test/browser/contracts/host-contracts.spec.mjs | wc -l"
  assert_success
  [ "$output" -ge 2 ]
  run bash -lc "grep -n \"expect(res && res.failed === 0).toBeTruthy()\" test/browser/contracts/host-contracts.spec.mjs | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

