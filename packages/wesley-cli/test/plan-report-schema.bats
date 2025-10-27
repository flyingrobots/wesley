#!/usr/bin/env bats

@test "plan --explain --json validates against plan-report.schema.json" {
  run node ../wesley-host-node/bin/wesley.mjs plan --schema ../../test/fixtures/examples/schema.graphql --explain --json
  if [ "$status" -ne 0 ]; then
    echo "OUTPUT:$output"
  fi
  [ "$status" -eq 0 ]
}

