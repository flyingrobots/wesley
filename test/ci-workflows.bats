#!/usr/bin/env bats

load 'vendor/bats-plugins/bats-support/load'
load 'vendor/bats-plugins/bats-assert/load'

@test "CI names distinguish Rust product checks from retired host experiments" {
  run bash -lc "grep -F 'name: Rust Product - Native CLI' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'Rust product preflight' .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "find .github/workflows -maxdepth 1 -type f -print | xargs grep -l 'External Host Experiment' | wc -l"
  assert_success
  [ "$output" -eq 0 ]
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

  run bash -lc "grep -F \"'schemas/**'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F \"'test/fixtures/weslaw/**'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F \"'test/fixtures/extension-generation/**'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F 'pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271' .github/workflows/rust-native.yml | wc -l"
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
  run bash -lc "grep -F 'pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271' .github/workflows/release-crates.yml | wc -l"
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

@test "workflow pnpm installs are frozen and verify lockfile drift" {
  run bash -lc "grep -R -n -- '--no-frozen-lockfile' .github/workflows .github/actions || true"
  assert_success
  [ -z "$output" ]

  run bash -lc "grep -R -n 'pnpm install' .github/workflows .github/actions | grep -v -- '--frozen-lockfile' || true"
  assert_success
  [ -z "$output" ]

  run bash -lc '
    set -euo pipefail
    missing=()
    while IFS= read -r file; do
      grep -Fq "git diff --exit-code -- pnpm-lock.yaml" "$file" || missing+=("$file")
    done < <(grep -R -l "pnpm install --frozen-lockfile" .github/workflows .github/actions)
    if [ "${#missing[@]}" -gt 0 ]; then
      printf "%s\n" "${missing[@]}"
      exit 1
    fi
  '
  assert_success
  [ -z "$output" ]
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

@test "retired host experiment surfaces do not return" {
  run test ! -e .github/workflows/browser-smoke.yml
  assert_success

  run test ! -e .github/workflows/pkg-host-bun.yml
  assert_success

  run test ! -e .github/workflows/pkg-host-deno.yml
  assert_success

  run test ! -e .github/workflows/runtime-smokes.yml
  assert_success

  run test ! -e packages/wesley-host-browser/package.json
  assert_success

  run test ! -e packages/wesley-host-bun/package.json
  assert_success

  run test ! -e packages/wesley-host-deno/package.json
  assert_success

  run test ! -e scripts/host_contracts_browser.mjs
  assert_success

  run test ! -e scripts/host_contracts_bun.mjs
  assert_success

  run test ! -e scripts/host_contracts_deno.mjs
  assert_success
}

@test "retired website and playground surfaces do not return" {
  run test ! -e .github/workflows/wesley-website.yml
  assert_success

  run test ! -e wesley-website/package.json
  assert_success

  run test ! -e docs/plans/james-website-integration
  assert_success

  run bash -lc "grep -F \"'wesley-website/package.json'\" .github/workflows/rust-native.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F \"wesley-website\" pnpm-workspace.yaml package.json | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

@test "general CI does not call retired host experiment Bats suites" {
  run bash -lc "grep -E 'ci-browser-smoke|ci-pkg-host-bun|deno-host-webcrypto-guard|browser-contracts' .github/workflows/ci.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

@test "HOLMES workflow uses Wesley project manifest for selective schema sets" {
  # Exact counts below pin the four matrix consumers and three report uploaders.
  # If a job is added or removed, this contract should be reviewed deliberately.
  run bash -lc "grep -F 'detect-schema-sets:' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'cargo run --bin wesley -- config inspect --json' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'manifest_status=' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'No Wesley manifest found' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'Wesley manifest discovery failed; refusing legacy fallback' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'exit \"\$manifest_status\"' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'cargo run --bin wesley -- config changed-schemas' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'schema_set: \${{ fromJson(needs.detect-schema-sets.outputs.schema_sets) }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 4 ]

  run bash -lc "grep -F 'mkdir -p \"reports-by-schema/\${{ matrix.schema_set.id }}\"' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 3 ]

  run bash -lc "grep -F 'path: reports-by-schema/\${{ matrix.schema_set.id }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 3 ]

  run bash -lc "grep -E '^[[:space:]]+path: reports-by-schema$' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'cache-namespace:' .github/actions/holmes-setup/action.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'moriarty-\${{ inputs.cache-namespace }}-\${{ github.sha }}' .github/actions/holmes-setup/action.yml | wc -l"
  assert_success
  [ "$output" -eq 2 ]

  run bash -lc "grep -F 'cache-namespace: \${{ matrix.schema_set.id }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 4 ]

  run bash -lc "grep -F 'steps.detect.outputs.selected_count' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

@test "repo Bats tests use vendored plugins without runtime fetches" {
  run test -f test/vendor/bats-plugins/bats-support/load.bash
  assert_success

  run test -f test/vendor/bats-plugins/bats-assert/load.bash
  assert_success

  run test -f test/vendor/bats-plugins/bats-file/load.bash
  assert_success

  run bash -lc "grep -F 'BATS_LIB_PATH: test/vendor' .github/workflows/ci.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'scripts/setup-bats-plugins.sh' .github/workflows/ci.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -E 'git clone|curl --proto|https://github.com/bats-core' scripts/setup-bats-plugins.sh scripts/dev/setup-bats-plugins.sh | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'BATS_LIB_PATH=test/vendor' docs/ci.md docs/guides/cli-tests.md test/README.md | wc -l"
  assert_success
  [ "$output" -ge 3 ]
}

@test "cert-shipme certifies only landed target-branch commits" {
  run bash -lc "grep -F 'pull_request:' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'branches: [main]' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'Commit: \${GITHUB_SHA}' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F '<!-- SHIPME_COMMENT -->' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'Wait for HOLMES suite comment' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'HOLMES_SUITE_SHA:' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'github.rest.issues.updateComment' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F 'github.rest.issues.createComment' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

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
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'rehearse --schema test/fixtures/blade/schema-v1.graphql' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -eq 0 ]

  run bash -lc "grep -F '.wesley-cache/holmes-report.json' .github/workflows/cert-shipme.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]
}

@test "retired progress workflow and README updater do not return" {
  run test ! -e .github/workflows/progress.yml
  assert_success

  run test ! -e scripts/compute-progress.mjs
  assert_success

  run test ! -e meta/progress.config.json
  assert_success

  run bash -lc "grep -E 'BEGIN:OVERALL_STATUS|BEGIN:PACKAGE_MATRIX' README.md | wc -l"
  assert_success
  [ "$output" -eq 0 ]
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
  run bash -lc "cd '$tmp_dir' && node '$PWD/scripts/prepare-shipme-cert-fixture.mjs' && grep -F '\"verdict\": \"PASS\"' .wesley-cache/realm.json && grep -F '\"version\": \"2.0.0\"' .wesley-cache/scores.json && grep -F '\"commit\": \"abcdef1234567890abcdef1234567890abcdef12\"' .wesley-cache/scores.json && grep -F '\"metadata\"' .wesley-cache/scores.json && grep -F '\"readiness\"' .wesley-cache/bundle.json && grep -F '\"lines\": \"1-2\"' .wesley-cache/bundle.json && grep -F '\"lines\": \"1-1\"' .wesley-cache/bundle.json"
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

@test "release crates workflow verifies every published crate" {
  for crate in wesley-core wesley-emit-codec wesley-emit-rust wesley-emit-typescript wesley-cli; do
    run bash -lc "awk '/name: Verify crates.io visibility/{in_step=1} in_step && /^      - name: Finalize GitHub Release/{exit} in_step {print}' .github/workflows/release-crates.yml | grep -F '$crate'"
    assert_success
  done
}

@test "release crates workflow retries crates.io visibility checks" {
  run grep -F "for attempt in \$(seq 1 30)" .github/workflows/release-crates.yml
  assert_success

  run grep -F "did not become visible on crates.io in time" .github/workflows/release-crates.yml
  assert_success

  run grep -F "sleep 10" .github/workflows/release-crates.yml
  assert_success
}

@test "release crates visibility assertion is scoped to visibility step" {
  run bash -lc "awk '/@test \"release crates workflow verifies every published crate\"/{in_test=1} in_test && /^@test / && !/release crates workflow verifies every published crate/{exit} in_test {print}' test/ci-workflows.bats | grep -F 'Verify crates.io visibility'"
  assert_success
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

@test "release crates workflow classifies pre-release, stable, and build-metadata tags" {
  # Exercise the workflow's own channel-classification shell across tag shapes
  # instead of grepping for token presence (a plain '--latest' grep also matches
  # '--latest=false' and proves nothing about the mapping). Extract the Classify
  # step's run body and run it for each shape.
  local snippet
  snippet="$(awk '
    /- name: Classify release channel/ { f = 1; next }
    f && /^      - name: / { exit }
    f && /run: \|/ { r = 1; next }
    f && r { print }
  ' .github/workflows/release-crates.yml)"
  [ -n "$snippet" ]

  classify() {
    local env_file="$BATS_TEST_TMPDIR/gh_env"
    : > "$env_file"
    GITHUB_REF_NAME="$1" GITHUB_ENV="$env_file" bash -c "$snippet"
    grep -F 'WESLEY_PRERELEASE=' "$env_file"
  }

  [ "$(classify v0.3.0)" = "WESLEY_PRERELEASE=false" ]
  [ "$(classify v0.3.0-alpha.1)" = "WESLEY_PRERELEASE=true" ]
  [ "$(classify v1.0.0+build.7)" = "WESLEY_PRERELEASE=false" ]
  [ "$(classify v0.3.0-alpha.1+build.7)" = "WESLEY_PRERELEASE=true" ]

  # The classified value must map to the exact publish flags: pre-release =>
  # --prerelease --latest=false, stable => --latest. Asserting the exact array
  # literals (not a bare '--latest' substring) proves the branch mapping.
  run grep -F 'if [ "${WESLEY_PRERELEASE}" = "true" ]; then' .github/workflows/release-crates.yml
  assert_success
  run grep -F 'channel_flags=(--latest)' .github/workflows/release-crates.yml
  assert_success
  run grep -F 'channel_flags=(--prerelease --latest=false)' .github/workflows/release-crates.yml
  assert_success
}

@test "pull request template preserves rollback metadata" {
  run grep -F '## Backout' .github/pull_request_template.md
  assert_success

  run grep -F 'How to revert safely; follow-up cleanup if rollback happens.' .github/pull_request_template.md
  assert_success

  run grep -F 'Merge commit only; no rebase.' .github/pull_request_template.md
  assert_success
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

@test "wesley-holmes workflow propagates selected schema matrix into analysis jobs" {
  run bash -lc "grep -F 'outputs:' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'schema_sets: \${{ steps.detect.outputs.schema_sets }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'selected_count: \${{ steps.detect.outputs.selected_count }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'comment_mode: \${{ steps.detect.outputs.comment_mode }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'commentMode ||' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F \"comment_mode != 'silent'\" .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'matrix.schema_set.schema' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 4 ]

  run bash -lc "grep -F 'matrix.schema_set.bundle_dir' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 4 ]

  run bash -lc "grep -F 'needs: [detect-schema-sets, wesley-generate, holmes-investigate]' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'needs: [detect-schema-sets, wesley-generate, watson-verify]' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc 'grep -F '\''elif [ -n "${HOLMES_SCHEMA:-}" ] && [ -f "$HOLMES_SCHEMA" ]; then'\'' .github/workflows/wesley-holmes.yml | wc -l'
  assert_success
  [ "$output" -eq 1 ]
}

@test "wesley-holmes workflow builds PR comments via the Holmes comment builder" {
  run bash -lc "grep -A80 '^  comment-report:' .github/workflows/wesley-holmes.yml | grep -F 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0' | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'packages/wesley-holmes/src/pr-comment-cli.mjs' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'SCHEMA_SETS_JSON: \${{ needs.detect-schema-sets.outputs.schema_sets }}' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F -- '--schema-sets-json \"\$SCHEMA_SETS_JSON\"' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'reports/pr-comment.md' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -ge 2 ]

  run bash -lc "grep -F '<!-- HOLMES_SUITE_COMMENT -->' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'github.paginate(github.rest.issues.listComments' .github/workflows/wesley-holmes.yml | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -F 'per_page: 100' .github/workflows/wesley-holmes.yml | wc -l"
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

  run bash -lc "grep -A140 '^  comment-report:' .github/workflows/wesley-holmes.yml | grep -F 'Ensure history for MORIARTY' | wc -l"
  assert_success
  [ "$output" -eq 0 ]
}

# --- release autotag (Continuum release runbook, sections 16 and 30.2) -------

autotag_workflow=".github/workflows/release-autotag.yml"

@test "release autotag runs only on pushes to main" {
  run bash -lc "awk '/^on:/{f=1;next} f&&/^[a-z]/{exit} f' $autotag_workflow"
  assert_success
  assert_output --partial "push:"
  assert_output --partial "- main"
  refute_output --partial "pull_request"
  refute_output --partial "tags:"
}

@test "release autotag holds write permission only on the job that tags" {
  # The workflow default must be read-only; one job may write contents.
  run bash -lc "awk '/^permissions:/{f=1;next} f&&/^[a-z]/{exit} f' $autotag_workflow"
  assert_success
  assert_output --partial "contents: read"
  refute_output --partial "write"

  run bash -lc "grep -c 'contents: write' $autotag_workflow"
  assert_success
  [ "$output" -eq 1 ]

  # A job-level block sets every unlisted permission to none. The guards list
  # issues and workflow runs, so the job must be able to read both.
  run bash -lc "awk '/^  autotag:/{j=1} j&&/^    permissions:/{f=1;next} f&&/^    [a-z]/{exit} f' $autotag_workflow"
  assert_success
  assert_output --partial "issues: read"
  assert_output --partial "actions: read"
  assert_output --partial "pull-requests: read"
}

@test "release autotag creates an annotated tag and never forces or moves one" {
  run bash -lc "grep -F 'git tag -a \"\${tag}\" -m \"release: \${tag}\"' $autotag_workflow | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -nE 'git tag .*(-f|--force)|git push .*(-f |--force|\\+refs)|git tag -d|push --delete|\" *:refs/tags' $autotag_workflow || true"
  assert_success
  [ -z "$output" ]
}

@test "release autotag pushes its tag atomically, with a check that main had not already moved" {
  # The gates take minutes. Naming the release commit for main in the same
  # atomic push is a no-op while main has not moved, and a refused
  # non-fast-forward, which takes the tag down with it, once it has. It narrows
  # the race from minutes to the push itself; it is not a server-side
  # compare-and-swap, and the workflow says so.
  run bash -lc "grep -F 'git push --atomic origin \"\${sha}:refs/heads/main\" \"refs/tags/\${tag}\"' $autotag_workflow | wc -l"
  assert_success
  [ "$output" -eq 1 ]

  # That is the only push in the workflow.
  run bash -lc "grep -c 'git push' $autotag_workflow"
  assert_success
  [ "$output" -eq 1 ]
}

@test "release autotag never publishes" {
  run bash -lc "grep -nE 'cargo publish|publish-crates|publish-alpha|gh release (create|edit)|CARGO_REGISTRY_TOKEN' $autotag_workflow || true"
  assert_success
  [ -z "$output" ]
}

@test "release autotag passes pull request text through the environment, never a command line" {
  # A pull request title is text a contributor chose. It may appear under an
  # env: key, and must never be interpolated into a run: script.
  run bash -lc "grep -c 'AUTOTAG_PR_TITLE: \${{ steps.pr.outputs.title }}' $autotag_workflow"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "awk '/run: \\|/{r=1;next} r&&/^      - name:/{r=0} r' $autotag_workflow | grep -nE '\\\$\\{\\{ *(steps\\.pr|github\\.event)' || true"
  assert_success
  [ -z "$output" ]
}

@test "release autotag runs the full release guard on a local tag before anything is pushed" {
  # A pushed tag is immutable. If release-guard would reject it, the version is
  # burned, so the guard must pass against a local tag first.
  local prep check tag guard push
  prep="$(grep -n 'cargo xtask release-prep-guard --version' "$autotag_workflow" | head -1 | cut -d: -f1)"
  check="$(grep -n 'run: cargo xtask release-check' "$autotag_workflow" | head -1 | cut -d: -f1)"
  [ -n "$check" ] && [ "$prep" -lt "$check" ]
  tag="$(grep -n 'git tag -a' "$autotag_workflow" | head -1 | cut -d: -f1)"
  guard="$(grep -n 'cargo xtask release-guard --tag' "$autotag_workflow" | head -1 | cut -d: -f1)"
  push="$(grep -n 'git push --atomic' "$autotag_workflow" | head -1 | cut -d: -f1)"
  [ -n "$prep" ] && [ -n "$tag" ] && [ -n "$guard" ] && [ -n "$push" ]
  [ "$check" -lt "$tag" ]
  [ "$tag" -lt "$guard" ]
  [ "$guard" -lt "$push" ]

  # Every step after the plan is conditional on the plan saying "tag".
  run bash -lc "grep -c \"if: steps.plan.outputs.decision == 'tag'\" $autotag_workflow"
  assert_success
  [ "$output" -ge 7 ]
}

@test "release autotag waits, with a deadline, for the other CI runs on the release commit" {
  # release-guard requires every other run on HEAD to be complete and green, and
  # they start at the same moment this workflow does.
  local wait guard
  wait="$(grep -n 'gh run list --commit' "$autotag_workflow" | head -1 | cut -d: -f1)"
  guard="$(grep -n 'cargo xtask release-guard --tag' "$autotag_workflow" | head -1 | cut -d: -f1)"
  [ -n "$wait" ] && [ -n "$guard" ]
  [ "$wait" -lt "$guard" ]

  run bash -lc "grep -c 'deadline' $autotag_workflow"
  assert_success
  [ "$output" -ge 2 ]
}

@test "release autotag confirms the commit is still origin/main and prints the publish command" {
  run bash -lc "grep -F 'git rev-parse origin/main' $autotag_workflow | wc -l"
  assert_success
  [ "$output" -ge 1 ]

  run bash -lc "grep -F 'gh workflow run release-crates.yml --ref' $autotag_workflow | wc -l"
  assert_success
  [ "$output" -eq 1 ]
}

@test "release crates workflow can be dispatched from a tag, and only from a tag" {
  # A tag pushed with a workflow's GITHUB_TOKEN does not trigger on-push-tag
  # workflows, so an autotagged release is published by explicit dispatch.
  run bash -lc "awk '/^on:/{f=1;next} f&&/^[a-z]/{exit} f' .github/workflows/release-crates.yml"
  assert_success
  assert_output --partial "workflow_dispatch:"
  assert_output --partial "tags:"

  run bash -lc "grep -c \"github.ref_type\" .github/workflows/release-crates.yml"
  assert_success
  [ "$output" -ge 1 ]
}

@test "release autotag gives each pushed commit its own concurrency slot" {
  # A concurrency group keeps one running and one pending run; a newer pending
  # run replaces an older one. With one group for every push to main, a burst of
  # merges could discard the only run that would recognize the release-prep
  # merge. Keying the group by commit means no run displaces another.
  run bash -lc "grep -A2 '^concurrency:' $autotag_workflow | grep -Ec 'group: release-autotag-\\$\\{\\{ github\\.sha \\}\\}'"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -A2 '^concurrency:' $autotag_workflow | grep -c 'cancel-in-progress: false'"
  assert_success
  [ "$output" -eq 1 ]
}

@test "release profile records that the autotag path needs a publish dispatch" {
  # A tag pushed with GITHUB_TOKEN does not start release-crates.yml, so on the
  # normal path publication does require a manual dispatch. A profile that says
  # otherwise tells an operator or a tool that the release publishes itself.
  run grep -E '^  autotag: \.github/workflows/release-autotag\.yml$' .continuum/release.yml
  assert_success

  run grep -E '^  manual_dispatch_required: true$' .continuum/release.yml
  assert_success
}

@test "release autotag sends a moved main to a new release boundary, not a manual tag" {
  # Once main has moved there is no valid commit to tag by hand. The release
  # commit is no longer synced main, and the new tip contains work the release
  # PR's sign-off never covered. Recovery is a new release-prep PR.
  run bash -lc "grep -A12 'name: Confirm the commit is still origin/main' $autotag_workflow | grep -ci 'tag manually'"
  [ "$output" -eq 0 ]

  run bash -lc "grep -A14 'name: Confirm the commit is still origin/main' $autotag_workflow | grep -c 'Do not tag either commit by hand'"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -A14 'name: Confirm the commit is still origin/main' $autotag_workflow | grep -c 'new release-prep PR'"
  assert_success
  [ "$output" -eq 1 ]
}

@test "release crates workflow checks visibility against the registry, not the checkout" {
  # Inside the repository every published crate exists at the release version,
  # and plain `cargo info crate@version` resolves that workspace member and
  # exits 0 without asking crates.io. --registry forces the registry lookup.
  crates=".github/workflows/release-crates.yml"

  run bash -lc "grep -A16 'name: Verify crates.io visibility' $crates | grep -c 'cargo info'"
  assert_success
  [ "$output" -eq 1 ]

  run bash -lc "grep -A16 'name: Verify crates.io visibility' $crates | grep -cF 'cargo info \"\${crate}@\${version}\" --registry crates-io'"
  assert_success
  [ "$output" -eq 1 ]
}
