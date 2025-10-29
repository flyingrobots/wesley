#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  HOST="${HOST:-node}"
}

@test "host contracts pass on selected host" {
  if [ "$HOST" = "node" ]; then
    run node scripts/host_contracts_node.mjs
  elif [ "$HOST" = "deno" ]; then
    run deno run --config deno.json -A scripts/host_contracts_deno.ts
  elif [ "$HOST" = "bun" ]; then
    run bun run scripts/host_contracts_bun.mjs
  elif [ "$HOST" = "browser" ]; then
    run node scripts/host_contracts_browser.mjs
  else
    echo "Unknown HOST=$HOST" >&2
    return 1
  fi

  assert_success
  # Validate JSON and ensure failed == 0 (pipe prior output into validator)
  printf "%s" "$output" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.failed!==0) { console.error(j); process.exit(1);} })'
}
