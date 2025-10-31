# Continuous Integration

This repository uses multiple GitHub Actions workflows to keep the codebase healthy and fast. This page documents the key workflows, reusable pieces, and a few conventions we follow.

## Workflows Overview

- `ci.yml` — Main pipeline. Installs deps, runs unit tests, and executes a small set of repository-level Bats tests (server/progress/CI checks) when relevant.
- `runtime-smokes.yml` — Runtime smoke tests for Node, Deno, and Bun host-contracts.
- `browser-smoke.yml` — Builds the browser host-contracts bundle and runs Playwright.
- `preflight.yml` — Hygiene checks (docs links, dependency boundaries, ESLint purity, license audit).
- Package workflows — e.g., `pkg-core.yml`, `pkg-host-bun.yml` with focused tests.

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
- Progress script safety (`--dry-run`, marker updates)
- CI YAML invariants (e.g., Bun pins)
- Browser-contracts spec greps and diagnostics

To keep CI lean, these tests are gated via a simple diff check and only execute when relevant files change (paths matching `scripts/serve-static.mjs`, `scripts/compute-progress.mjs`, `test/serve-static*`, `test/progress-*`, `test/ci-*`, `test/browser-contracts-*`, or `test/deno-host-webcrypto-guard.bats`).

## Playwright Caching & Version Pinning

- Workflows respect `PLAYWRIGHT_VERSION` and set `PLAYWRIGHT_BROWSERS_PATH` to cache browsers under `~/.cache/ms-playwright`.
- The browser smokes use `pnpm dlx playwright install --with-deps` for deterministic installs.

## Bun Version Pinning

- Runtime smokes and `pkg-host-bun.yml` pin `bun-version: 1.2.20` (no `latest`) to avoid nondeterministic breakages.

## Artifacts

The `browser-smoke.yml` workflow uploads the host-contracts JSON (`OUT_JSON`) for easier debugging when failures occur.

