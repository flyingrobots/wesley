#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

# Size: medium. Builds the CLI once, then runs it in scratch directories.
# Oracle: the binary. The documentation is the thing under test, not the code:
# each page is replayed against the real CLI.

setup_file() {
  cargo build --quiet --bin wesley
  export WESLEY_BIN="$PWD/target/debug/wesley"
}

@test "the sessions shown in the README and the getting-started guide replay as written" {
  run node scripts/run-doc-examples.mjs --wesley "$WESLEY_BIN" README.md docs/getting-started.md
  assert_success
  # Witness count: a replay that ran nothing proves nothing.
  assert_output --regexp '^ran [1-9][0-9]* documented commands and compared [1-9][0-9]* outputs'
}

@test "the CLI reference is what the binary prints" {
  run node scripts/generate-cli-reference.mjs --wesley "$WESLEY_BIN" --check
  assert_success
}
