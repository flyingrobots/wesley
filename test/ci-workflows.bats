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

  run bash -lc "grep -F 'pull-requests: write' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'Run HOLMES investigation' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'transform --schema test/fixtures/blade/schema-v1.graphql --emit-bundle --out-dir out' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'plan --schema test/fixtures/blade/schema-v1.graphql --write --out-dir out' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'rehearse --schema test/fixtures/blade/schema-v1.graphql' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F '.wesley-cache/holmes-report.json' .github/workflows/cert-shipme.yml | wc -l"
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

  run bash -lc "grep -F 'if:' .github/workflows/progress.yml | grep -F 'env.PROGRESS_PR_TOKEN' | wc -l"
  assert_success
  [ "$output" -eq 1 ]
}

@test "workflows do not reference secrets directly in if conditionals" {
  run bash -lc "grep -R -nE 'if:[[:space:]]*\\$\\{\\{[[:space:]]*secrets\\.' .github/workflows || true"
  assert_success
  [ -z "$output" ]
}

@test "property fuzzing workflow runs wesley-core fuzz suite" {
  run bash -lc "grep -F 'Property-based fuzzing with fast-check' .github/workflows/fuzzing.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'pnpm --filter @wesley/core test:fuzz' .github/workflows/fuzzing.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]
}

@test "wesley-holmes workflow propagates detected schema outputs into analysis jobs" {
  run bash -lc "grep -F 'outputs:' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'steps.detect.outputs.schema' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F 'steps.detect.outputs.bundle_dir' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F 'needs.wesley-generate.outputs.schema' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 3 ]

  run bash -lc "grep -F 'needs.wesley-generate.outputs.bundle_dir' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 4 ]

  run bash -lc "grep -F 'needs: [wesley-generate, holmes-investigate]' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'needs: [wesley-generate, watson-verify]' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc 'grep -F '\''elif [ -n "${HOLMES_SCHEMA:-}" ] && [ -f "$HOLMES_SCHEMA" ]; then'\'' .github/workflows/wesley-holmes.yml | wc -l'
  assert_success
  [ "$output" -eq 1 ]
}

@test "wesley-holmes workflow builds PR comments via the Holmes comment builder" {
  run bash -lc "grep -F 'packages/wesley-holmes/src/pr-comment-cli.mjs' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'reports/pr-comment.md' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F '<!-- HOLMES_SUITE_COMMENT -->' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]
}
