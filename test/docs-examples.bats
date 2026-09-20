#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

# Size: medium. Builds the CLI once, then runs it in scratch directories.
# Oracle: the binary. The documentation is the thing under test, not the code:
# each page is replayed against the real CLI.

# `cargo xtask docs-replay` runs the same two checks; `cargo xtask preflight`
# calls it, so a stale page fails the local gate as well as this suite.
setup_file() {
  cargo build --quiet --bin wesley
  export WESLEY_BIN="$PWD/target/debug/wesley"
}

@test "the sessions shown in the README and the getting-started guide replay as written" {
  run node scripts/run-doc-examples.mjs --wesley "$WESLEY_BIN" README.md docs/getting-started.md
  assert_success
  # A witness count for each page: one that contributed nothing was not checked.
  assert_line --regexp '^README\.md: ran [1-9][0-9]*, compared [1-9][0-9]*$'
  assert_line --regexp '^docs/getting-started\.md: ran [1-9][0-9]*, compared [1-9][0-9]*$'
}

@test "the CLI reference is what the binary prints" {
  run node scripts/generate-cli-reference.mjs --wesley "$WESLEY_BIN" --check
  assert_success
}
