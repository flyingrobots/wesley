#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "contentType maps js to application/javascript" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('x.js'))})\""
  assert_success
  assert_output "application/javascript; charset=utf-8"
}

