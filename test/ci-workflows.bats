#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

yaml_job_block() {
  local job_name="$1"
  local workflow="${2:-.github/workflows/runtime-smokes.yml}"
  awk -v job="$job_name" '
    $0 == "  " job ":" { in_block = 1 }
    in_block && $0 ~ /^  [A-Za-z0-9_-]+:/ && $0 != "  " job ":" { exit }
    in_block { print }
  ' "$workflow"
}

@test "runtime-smokes uses composite action to install bats (no raw apt-get)" {
  run bash -lc "grep -n 'apt-get install -y bats jq' .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'uses: ./.github/actions/install-bats' .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  # Only the retained Bats-backed Deno runtime smoke should need this setup.
  [ "$output" -eq 1 ]
}

@test "runtime-smokes Bun job uses official Bun setup without Bats" {
  run yaml_job_block bun-smoke
  assert_success
  [[ "$output" != *"uses: ./.github/actions/install-bats"* ]]
  [[ "$output" == *"oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6"* ]]
  [[ "$output" == *"bun run scripts/host_contracts_bun.mjs"* ]]
}

@test "workflow job block helper stops before the next job" {
  tmp_workflow="$(mktemp -t wesley-runtime-smoke-workflow-XXXXXX.yml)"
  cat >"$tmp_workflow" <<'YAML'
jobs:
  bun-smoke:
    steps:
      - uses: oven-sh/setup-bun@example
      - run: bun run scripts/host_contracts_bun.mjs
  later-bats-job:
    steps:
      - uses: ./.github/actions/install-bats
YAML

  run yaml_job_block bun-smoke "$tmp_workflow"
  rm -f "$tmp_workflow"
  assert_success
  [[ "$output" == *"bun run scripts/host_contracts_bun.mjs"* ]]
  [[ "$output" != *"later-bats-job"* ]]
  [[ "$output" != *"uses: ./.github/actions/install-bats"* ]]
}

@test "CI names distinguish Rust product checks from external host experiments" {
  run bash -lc "grep -F 'name: Rust Product - Native CLI' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'Rust product preflight' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'name: External Host Experiments - Runtime Smokes' .github/workflows/runtime-smokes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'External host experiment - Deno smoke' .github/workflows/runtime-smokes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'External host experiment - Bun smoke' .github/workflows/runtime-smokes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'Node host smoke' .github/workflows/runtime-smokes.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'name: External Host Experiment - Browser Smoke' .github/workflows/browser-smoke.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'name: External Host Experiment - pkg-host-bun' .github/workflows/pkg-host-bun.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'name: External Host Experiment - pkg-host-deno' .github/workflows/pkg-host-deno.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]
}

@test "general CI uses native CLI for product schema smoke" {
  run bash -lc "grep -F 'Rust product native schema lower smoke' .github/workflows/ci.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'cargo run --bin wesley -- schema lower' .github/workflows/ci.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'node packages/wesley-host-node/bin/wesley.mjs generate --schema test/fixtures/examples/ecommerce.graphql' .github/workflows/ci.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]
}

@test "rust native preflight provisions pnpm and watches audit inputs" {
  run bash -lc "grep -F \"'package.json'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F \"'packages/**/package.json'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F \"'pnpm-lock.yaml'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F \"'pnpm-workspace.yaml'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F \"'wesley-website/package.json'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F 'pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'pnpm install --frozen-lockfile' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "pnpm_setup=\$(grep -n 'pnpm/action-setup' .github/workflows/rust-native.yml | cut -d: -f1); pnpm_install=\$(grep -n 'pnpm install --frozen-lockfile' .github/workflows/rust-native.yml | cut -d: -f1); preflight=\$(grep -n 'cargo xtask preflight' .github/workflows/rust-native.yml | cut -d: -f1); [ \"\$pnpm_setup\" -lt \"\$pnpm_install\" ] && [ \"\$pnpm_install\" -lt \"\$preflight\" ]"
  assert_success
}

@test "release crates provisions pnpm before preflight-backed commands" {
  run bash -lc "grep -F 'pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F 'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F 'pnpm install --frozen-lockfile' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "first_install=\$(grep -n 'pnpm install --frozen-lockfile' .github/workflows/release-crates.yml | sed -n '1p' | cut -d: -f1); second_install=\$(grep -n 'pnpm install --frozen-lockfile' .github/workflows/release-crates.yml | sed -n '2p' | cut -d: -f1); first_guard=\$(grep -n 'cargo xtask release-guard' .github/workflows/release-crates.yml | sed -n '1p' | cut -d: -f1); release_check=\$(grep -n 'cargo xtask release-check' .github/workflows/release-crates.yml | cut -d: -f1); second_guard=\$(grep -n 'cargo xtask release-guard' .github/workflows/release-crates.yml | sed -n '2p' | cut -d: -f1); [ \"\$first_install\" -lt \"\$first_guard\" ] && [ \"\$first_install\" -lt \"\$release_check\" ] && [ \"\$second_install\" -lt \"\$second_guard\" ]"
  assert_success
}

@test "deleted legacy workflow files do not return" {
  run test ! -e .github/workflows/cli-quick.yml
  assert_success

  run test ! -e .github/workflows/cli-tests.yml
  assert_success

  run test ! -e .github/workflows/pkg-host-node.yml
  assert_success

  run test ! -e .github/workflows/fuzzing.yml
  assert_success

  run test ! -e scripts/host_contracts_node.mjs
  assert_success
}

@test "cert-shipme anchors and paginates bot comments" {
  run bash -lc "grep -F '<!-- SHIPME_COMMENT -->' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"github-actions[bot]\" .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'per_page: 100' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'pull-requests: write' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'actions: read' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'Run HOLMES investigation' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'transform --schema test/fixtures/blade/schema-v1.graphql --emit-bundle --out-dir out' .github/workflows/cert-shipme.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'Prepare passing SHIPME certificate fixture' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'node scripts/prepare-shipme-cert-fixture.mjs' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"'scripts/prepare-shipme-cert-fixture.mjs'\" .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F 'rehearse --schema test/fixtures/blade/schema-v1.graphql' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F '.wesley-cache/holmes-report.json' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'Wait for HOLMES suite comment' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'HOLMES_SUITE_SHA:' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"steps.holmes_comment_wait.outputs.ready == 'true'\" .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'actions/workflows/{workflow_id}/runs' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F '2 * 60 * 60 * 1000' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'const maxNoRunFound = 20' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'No wesley-holmes.yml run found for' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'core.setFailed(' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
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

@test "architecture boundaries workflow excludes product scaffold from required packages" {
  run bash -lc "grep -F 'wesley-scaffold-multitenant' .github/workflows/architecture-boundaries.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

@test "architecture boundaries workflow excludes deleted task package from required packages" {
  run bash -lc "grep -F 'wesley-tasks' .github/workflows/architecture-boundaries.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

@test "deleted task package no longer has a package workflow" {
  run test ! -e .github/workflows/pkg-tasks.yml
  assert_success
}

@test "deleted legacy Node packages no longer have manifests" {
  run test ! -e packages/wesley-core/package.json
  assert_success

  run test ! -e packages/wesley-cli/package.json
  assert_success

  run test ! -e packages/wesley-host-node/package.json
  assert_success

  run test ! -e packages/wesley-runtime-node/package.json
  assert_success
}

@test "shipme certificate fixture prepares PASS realm and exact evidence" {
  tmp_dir="$(mktemp -d -t wesley-shipme-fixture-XXXXXX)"
  run bash -lc "cd '$tmp_dir' && node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' && grep -F '\"verdict\": \"PASS\"' .wesley-cache/realm.json && grep -F '\"readiness\"' .wesley-cache/bundle.json && grep -F '\"lines\": \"1-2\"' .wesley-cache/bundle.json && grep -F '\"lines\": \"1-1\"' .wesley-cache/bundle.json"
  rm -rf "$tmp_dir"
  assert_success
}

@test "release crates workflow creates draft release before publishing crates" {
  run bash -lc "grep -n 'Create draft GitHub Release' .github/workflows/release-crates.yml | cut -d: -f1"
  assert_success
  [ -n "$output" ]
  draft_line="$output"

  run bash -lc "grep -n 'Publish crates' .github/workflows/release-crates.yml | cut -d: -f1"
  assert_success
  [ -n "$output" ]
  publish_line="$output"

  [ "$draft_line" -lt "$publish_line" ]

  run bash -lc "grep -n 'Finalize GitHub Release' .github/workflows/release-crates.yml | cut -d: -f1"
  assert_success
  [ -n "$output" ]
  finalize_line="$output"

  run bash -lc "grep -n 'Verify crates.io visibility' .github/workflows/release-crates.yml | cut -d: -f1"
  assert_success
  [ -n "$output" ]
  verify_line="$output"

  [ "$verify_line" -lt "$finalize_line" ]
}

@test "release crates workflow keeps release scratch files outside repository" {
  run bash -lc "grep -F '\${RUNNER_TEMP}/release-notes.md' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F '\${RUNNER_TEMP}/release-draft-state.txt' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'release-notes.md' .github/workflows/release-crates.yml | grep -v '\${RUNNER_TEMP}'"
  [ "$status" -eq 1 ]
  [ -z "$output" ]

  run bash -lc "grep -F 'release-draft-state.txt' .github/workflows/release-crates.yml | grep -v '\${RUNNER_TEMP}'"
  [ "$status" -eq 1 ]
  [ -z "$output" ]
}

@test "release crates workflow checks version milestones and labels" {
  run bash -lc "grep -F -- '--milestone' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F -- '--label' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]
}

@test "release crates workflow authenticates release guard GitHub API checks" {
  run bash -lc "grep -F 'actions: read' .github/workflows/release-crates.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -n 'name: Release guard' -A5 .github/workflows/release-crates.yml | grep -F 'GH_TOKEN: \${{ github.token }}' | wc -l"
  assert_success
  [ "$output" -eq 2 ]
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
  run bash -lc "grep -A80 '^  comment-report:' .github/workflows/wesley-holmes.yml | grep -F 'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd' | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'packages/wesley-holmes/src/pr-comment-cli.mjs' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'reports/pr-comment.md' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F '<!-- HOLMES_SUITE_COMMENT -->' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"comment.user.login === 'github-actions[bot]'\" .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"comment.body.includes('The Case of Pull Request')\" .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"(comment.body.includes(marker) || comment.body.includes('The Case of Pull Request'))\" .github/workflows/wesley-holmes.yml | wc -l || true"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc 'grep -F -- '\''--head-sha "$GITHUB_SHA"'\'' .github/workflows/wesley-holmes.yml | wc -l'
  assert_success
  [ "$output" -eq 1 ]
}
