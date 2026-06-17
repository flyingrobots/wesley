#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "front-door docs point to the domain-empty boundary packet" {
  run grep -F "[Domain-Empty Core Boundary](./docs/design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)" README.md
  assert_success

  run grep -F "[design/0014-domain-empty-core-boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)" docs/GUIDE.md
  assert_success

  run grep -F "[Domain-Empty Core Boundary](./design/0014-domain-empty-core-boundary/domain-empty-core-boundary.md)" docs/ARCHITECTURE.md
  assert_success
}

@test "domain-empty boundary card is pulled from asap into design" {
  run test -e docs/method/backlog/asap/SOURCE_domain-empty-wesley-core-boundary.md
  assert_failure

  run test -e docs/design/0014-domain-empty-core-boundary/SOURCE_domain-empty-wesley-core-boundary.md
  assert_success

  run grep -F "0014-domain-empty-core-boundary" docs/design/README.md
  assert_success
}

@test "legacy JS compile command is retired instead of owning product targets" {
  run test ! -e packages/wesley-cli/src/commands/compile.mjs
  assert_success

  run grep -F "wesley schema lower" docs/GUIDE.md
  assert_success
}

@test "end-to-end validation diagram routes node retirement through Rust preflight" {
  run grep -F "RustPreflight --> NodeRetirement[Node retirement ledger guard]" docs/END_TO_END.md
  assert_success

  run grep -F "LegacyPreflight --> NodeRetirement[Node retirement ledger guard]" docs/END_TO_END.md
  assert_failure
}

@test "BEARING active-gravity packet sections stay before tensions" {
  run awk '
    /^### 12\. Holmes `weslaw` Assurance Planning$/ { h12 = NR }
    /^### 13\. Continuum YOLO Runtime-Neutral Edict$/ { h13 = NR }
    /^## Tensions$/ { tensions = NR }
    END { exit !(h12 && h13 && tensions && h12 < tensions && h13 < tensions) }
  ' docs/BEARING.md
  assert_success
}
