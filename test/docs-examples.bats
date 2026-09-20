#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

# Size: medium. Builds the CLI, then runs it in scratch directories.
# Oracle: the binary. The documentation is the thing under test, not the code:
# each page is replayed against the real CLI.
#
# This goes through `cargo xtask docs-replay`, the command `cargo xtask preflight`
# also runs, so there is one place that knows where Cargo put the binary.

@test "the documentation agrees with the built CLI" {
  run cargo xtask docs-replay
  assert_success
  # A witness count for each page: one that contributed nothing was not checked.
  assert_line --regexp '^README\.md: ran [1-9][0-9]*, compared [1-9][0-9]*$'
  assert_line --regexp '^docs/getting-started\.md: ran [1-9][0-9]*, compared [1-9][0-9]*$'
  assert_line --regexp '^docs/cli\.md matches wesley '
}
