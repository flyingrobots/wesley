#!/usr/bin/env bats

@test "IR envelope schema validates sample envelope" {
  export WESLEY_LOG_FORMAT=text
  run env WESLEY_LOG_FORMAT=text node ../wesley-host-node/bin/wesley.mjs qir envelope-validate ../../test/fixtures/qir/sample-envelope.json
  if [ "$status" -ne 0 ]; then
    echo "OUTPUT:$output"
  fi
  [ "$status" -eq 0 ]
}
