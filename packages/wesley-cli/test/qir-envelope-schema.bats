#!/usr/bin/env bats

setup() {
  ROOT_DIR="${WESLEY_REPO_ROOT:-$(cd "$BATS_TEST_DIRNAME/../../.." && pwd)}"
  CLI="$ROOT_DIR/packages/wesley-host-node/bin/wesley.mjs"
  export WESLEY_REPO_ROOT="$ROOT_DIR"
}

@test "IR envelope schema validates sample envelope" {
  run env WESLEY_LOG_FORMAT=text node "$CLI" qir envelope-validate "$ROOT_DIR/test/fixtures/qir/sample-envelope.json"
  if [ "$status" -ne 0 ]; then
    echo "OUTPUT:$output"
  fi
  [ "$status" -eq 0 ]
  [[ "$output" == *"schemaIR"* ]] || [[ "$output" == *"valid"* ]] || [[ "$output" == *"ok"* ]] || [[ "$output" == *"envelope"* ]]
}
