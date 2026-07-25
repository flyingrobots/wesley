# Continuous Integration

This repository uses multiple GitHub Actions workflows to keep the codebase healthy and fast. This page documents the key workflows, reusable pieces, and a few conventions we follow.

## Workflows Overview

- `ci.yml` — Main pipeline. Installs dependencies, runs unit tests, and executes
  the repository-level Bats suites on every covered run.
- `rust-native.yml` — Rust product preflight for the native compiler kernel and CLI.
- `preflight.yml` — Repository hygiene checks (docs links, dependency boundaries, ESLint purity, license audit).
- Package workflows — focused checks for retained non-compiler packages such as Holmes.

Workflow names distinguish product checks from compatibility checks:

- `Rust Product ...` checks protect the native Rust product spine.
- `Repository Hygiene ...` checks protect repo coherence.
  Browser/Bun/Deno host experiment workflows are retired from the Wesley release
  surface.

## Reusable Pieces

### Install Bats Dependencies

Repository workflows install Bats, jq, and ripgrep through one checked-in
composite action. Run it after `actions/checkout` so the local action is
available:

```yaml
- name: Install Bats
  uses: ./.github/actions/install-bats
```

Use this action anywhere repository Bats suites run on Ubuntu.

## Repo-level Bats Tests

In `ci.yml`, we run a concise set of repository-level Bats suites covering:

- Static server behavior (content-type, traversal defenses)
- Docs planning-boundary guards
- CI YAML invariants

Repository-level Bats suites run unconditionally in CI. The explicit file list
and per-file timeout in `.github/workflows/ci.yml` are the canonical execution
manifest.

### Run these locally

```bash
pnpm run setup:bats-plugins
BATS_LIB_PATH=test/vendor \
  bats test/serve-static*.bats \
    test/docs-planning-boundary.bats \
    test/domain-empty-boundary.bats \
    test/ir-fixtures.bats \
    test/release-governance.bats \
    test/ci-*.bats
```
