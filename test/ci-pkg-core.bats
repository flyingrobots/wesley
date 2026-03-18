#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "pkg-core workflow quotes run step with @ token" {
  run bash -lc "awk '/@wesley\/core tests/{f=1} f && /run:/{print; exit}' .github/workflows/pkg-core.yml"
  assert_success
  # Expect run line contains surrounding double quotes
  [[ "$output" =~ run:\ \" ]]
}

@test "wesley-core npm lockfile tracks pg-parser bump" {
  run node <<'NODE'
const pkg = require('./packages/wesley-core/package.json')
const lock = require('./packages/wesley-core/package-lock.json')

const pkgSpec = pkg.dependencies['@supabase/pg-parser']
const lockSpec = lock.packages[''].dependencies['@supabase/pg-parser']
const resolved = lock.packages['node_modules/@supabase/pg-parser'].version

if (pkgSpec !== '^0.1.7') {
  console.error(`unexpected package.json spec: ${pkgSpec}`)
  process.exit(1)
}

if (lockSpec !== pkgSpec) {
  console.error(`lockfile spec mismatch: ${lockSpec} !== ${pkgSpec}`)
  process.exit(1)
}

if (resolved !== '0.1.7') {
  console.error(`resolved version mismatch: ${resolved}`)
  process.exit(1)
}
NODE
  assert_success
}
