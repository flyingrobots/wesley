#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "contentType maps extensions as expected (data-driven)" {
  # Associative array: ext -> expected content type
  declare -A MAP=(
    [js]="application/javascript; charset=utf-8"
    [html]="text/html; charset=utf-8"
    [css]="text/css; charset=utf-8"
    [png]="image/png"
    [jpg]="image/jpeg"
    [jpeg]="image/jpeg"
    [svg]="image/svg+xml"
    [json]="application/json"
    [map]="application/json"
  )

  for ext in "${!MAP[@]}"; do
    expected="${MAP[$ext]}"
    run bash -lc "node -e \"import('${PWD//\//\/}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('file.${ext}'))})\""
    assert_success
    if [[ "$output" != "$expected" ]]; then
      echo "Mismatch for .$ext: expected '$expected' but got '$output'" >&2
      return 1
    fi
  done
}
