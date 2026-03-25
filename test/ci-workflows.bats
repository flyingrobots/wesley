#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "runtime-smokes uses composite action to install bats (no raw apt-get)" {
  run bash -lc "grep -n 'apt-get install -y bats jq' .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'uses: ./.github/actions/install-bats' .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  # One per job (deno, bun, node)
  [ "$output" -ge 1 ]
}

@test "cert-shipme anchors and paginates bot comments" {
  run bash -lc "grep -F '<!-- SHIPME_COMMENT -->' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"github-actions[bot]\" .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'per_page: 100' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]
}

@test "progress workflow keeps GITHUB_TOKEN read-only and uses opt-in PR token" {
  run bash -lc "grep -F 'contents: read' .github/workflows/progress.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'contents: write' .github/workflows/progress.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'PROGRESS_PR_TOKEN' .github/workflows/progress.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}
