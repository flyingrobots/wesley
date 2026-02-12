#!/usr/bin/env bats

@test "rehearse --dry-run --json validates against realm.schema.json" {
  run node ../wesley-host-node/bin/wesley.mjs rehearse --schema ../../test/fixtures/examples/schema.graphql --dry-run --json
  if [ "$status" -ne 0 ]; then
    echo "OUTPUT:$output"
  fi
  [ "$status" -eq 0 ]
}

