#!/usr/bin/env bats

setup() {
  ROOT_DIR="${WESLEY_REPO_ROOT:-$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)}"
  CLI="$ROOT_DIR/packages/wesley-host-node/bin/wesley.mjs"
  export WESLEY_REPO_ROOT="$ROOT_DIR"
}

@test "plan --explain --json validates against plan-report.schema.json" {
  run node "$CLI" plan --schema "$ROOT_DIR/test/fixtures/examples/schema.graphql" --explain --json
  if [ "$status" -ne 0 ]; then
    echo "OUTPUT:$output"
  fi
  [ "$status" -eq 0 ]
}
