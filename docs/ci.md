# Continuous Integration

This repository uses multiple GitHub Actions workflows to keep the codebase healthy and fast. This page documents the key workflows, reusable pieces, and a few conventions we follow.

## Workflows Overview

- `ci.yml` — Main pipeline. Installs deps, runs unit tests, and executes a small set of repository-level Bats tests (server/docs/CI checks) when relevant.
- `rust-native.yml` — Rust product preflight for the native compiler kernel and CLI.
- `preflight.yml` — Repository hygiene checks (docs links, dependency boundaries, ESLint purity, license audit).
- Package workflows — focused checks for retained non-compiler packages such as Holmes.

Workflow names distinguish product checks from compatibility checks:

- `Rust Product ...` checks protect the native Rust product spine.
- `Repository Hygiene ...` checks protect repo coherence.
  Browser/Bun/Deno host experiment workflows are retired from the Wesley release
  surface.

## Reusable Pieces

### Install Bats (reusable workflow)

We provide a reusable workflow to install Bats and jq:

```yaml
- name: Install Bats
  uses: flyingrobots/wesley/.github/workflows/install-bats.yml@main
```

Use this anywhere Bats-based tests run (Linux runners).

## Repo-level Bats Tests (Gated)

In `ci.yml`, we run a concise set of repository-level Bats suites covering:

- Static server behavior (content-type, traversal defenses)
- Docs planning-boundary guards
- CI YAML invariants

To keep CI lean, these tests are gated via a simple diff check and only execute
when relevant files change (paths matching `scripts/serve-static.mjs`,
`scripts/generate-ir-fixtures.mjs`, `test/serve-static*`,
`test/docs-planning-boundary.bats`, `test/domain-empty-boundary.bats`,
`test/ir-fixtures.bats`, or `test/ci-*`).

Example gating snippet used in `ci.yml`:

```yaml
- name: Detect changes for repo Bats tests
  id: changelog
  run: |
    RANGE="${{ github.event.before }}..${{ github.sha }}"
    if [ "${{ github.event_name }}" = "pull_request" ] && [ -n "${{ github.event.pull_request.base.sha }}" ]; then
      RANGE="${{ github.event.pull_request.base.sha }}..${{ github.sha }}"
    fi
    CHANGED=$(git diff --name-only "$RANGE" || true)
    NEED=false
    echo "$CHANGED" | grep -E -q '^(scripts/serve-static\\.mjs|test/serve-static|scripts/generate-ir-fixtures\\.mjs|test/docs-planning-boundary\\.bats|test/domain-empty-boundary\\.bats|test/ir-fixtures\\.bats|test/ci-)' && NEED=true || true
    echo "RUN_BATS=$NEED" >> $GITHUB_ENV
- name: Repo Bats tests
  if: ${{ env.RUN_BATS == 'true' }}
  env:
    BATS_LIB_PATH: test/vendor
  run: bats test/serve-static*.bats test/docs-planning-boundary.bats test/domain-empty-boundary.bats test/ir-fixtures.bats test/ci-*.bats
```

### Run these locally

```bash
pnpm run setup:bats-plugins
BATS_LIB_PATH=test/vendor \
  bats test/serve-static*.bats test/docs-planning-boundary.bats test/domain-empty-boundary.bats test/ir-fixtures.bats test/ci-*.bats
```
