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

@test "compile targets remain module-owned instead of built-in product targets" {
  run grep -F "listModuleCapabilities(" packages/wesley-cli/src/commands/compile.mjs
  assert_success

  run grep -F "'wesley'," packages/wesley-cli/src/commands/compile.mjs
  assert_success

  run grep -F "'targets'" packages/wesley-cli/src/commands/compile.mjs
  assert_success

  run grep -F "No compile targets are available. Load a Wesley module that registers wesley.targets." packages/wesley-cli/src/commands/compile.mjs
  assert_success

  run grep -E "['\"](postgres|supabase|echo|continuum|jedit|warp-ttd|ttd)['\"]" packages/wesley-cli/src/commands/compile.mjs
  assert_failure
}
