#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "isWithinRoot() true for inside, false for outside" {
  ROOT=$(mktemp -d)
  INSIDE=$(node -e "const p=require('node:path'); console.log(p.resolve(process.argv[1], 'a/b.js'))" "$ROOT")
  OUTSIDE=$(node -e "const p=require('node:path'); console.log(p.resolve(process.argv[1], '../outside.txt'))" "$ROOT")

  run bash -lc "ROOT='$ROOT' IN='$INSIDE' OUT='$OUTSIDE' node -e \"import('${PWD//\//\/}/scripts/serve-static.mjs').then(m=>{console.log(m.isWithinRoot(process.env.ROOT, process.env.IN)); console.log(m.isWithinRoot(process.env.ROOT, process.env.OUT));})\""
  assert_success
  echo "$output" | sed -n '1p' | grep -q '^true$'
  echo "$output" | sed -n '2p' | grep -q '^false$'
}

