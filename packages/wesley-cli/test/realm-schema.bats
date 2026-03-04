#!/usr/bin/env bats

setup() {
  ROOT_DIR="${WESLEY_REPO_ROOT:-$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)}"
  CLI="$ROOT_DIR/packages/wesley-host-node/bin/wesley.mjs"
  export WESLEY_REPO_ROOT="$ROOT_DIR"
}

@test "rehearse --dry-run --json validates against realm.schema.json" {
  run node "$CLI" rehearse --schema "$ROOT_DIR/test/fixtures/examples/schema.graphql" --dry-run --json
  if [ "$status" -ne 0 ]; then
    echo "OUTPUT:$output"
  fi
  [ "$status" -eq 0 ]
  # Verify the output contains expected dry-run keys
  [[ "$output" == *'"plan"'* ]]
  [[ "$output" == *'"explain"'* ]]
}
