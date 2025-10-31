#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TMPDIR_E2E=$(mktemp -d)
  echo 'console.log("ok")' > "$TMPDIR_E2E/app.js"
  PORT=$(( 8800 + (RANDOM % 1000) ))
  node scripts/serve-static.mjs --dir="$TMPDIR_E2E" --port=$PORT > "$TMPDIR_E2E/server.log" 2>&1 &
  SRV_PID=$!
  # wait for server
  for i in {1..50}; do
    node -e "require('http').get('http://127.0.0.1:$PORT/',res=>{res.resume();process.exit(0)}).on('error',()=>process.exit(1))" && break
    sleep 0.1
  done
}

teardown() {
  if [ -n "$SRV_PID" ]; then
    kill "$SRV_PID" 2>/dev/null || true
  fi
  rm -rf "$TMPDIR_E2E" 2>/dev/null || true
}

@test "serve-static returns application/javascript for .js" {
  run bash -lc "node -e \"require('http').get('http://127.0.0.1:$PORT/app.js',res=>{console.log(String(res.statusCode));console.log(res.headers['content-type']);res.resume();}).on('error',e=>{console.error(e);process.exit(1)})\""
  assert_success
  # First line: status code
  echo "$output" | sed -n '1p' | grep -q '^200$'
  # Second line: content-type header
  echo "$output" | sed -n '2p' | grep -q '^application/javascript; charset=utf-8$'
}

@test "serve-static prevents traversal via encoded path" {
  run bash -lc "node -e \"require('http').get('http://127.0.0.1:$PORT/%2e%2e/README.md',res=>{console.log(String(res.statusCode));res.resume();}).on('error',e=>{console.error(e);process.exit(1)})\""
  assert_success
  echo "$output" | grep -q '^403$'
}

@test "serve-static prevents traversal via ../ sequences" {
  run bash -lc "node -e \"require('http').get('http://127.0.0.1:$PORT/../../README.md',res=>{console.log(String(res.statusCode));res.resume();}).on('error',e=>{console.error(e);process.exit(1)})\""
  assert_success
  echo "$output" | grep -q '^403$'
}
