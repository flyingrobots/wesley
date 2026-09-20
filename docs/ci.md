# Continuous Integration

This repository uses multiple GitHub Actions workflows to keep the codebase healthy and fast. This page documents the key workflows, reusable pieces, and a few conventions we follow.

## Workflows Overview

- `ci.yml` — Main pipeline. Installs deps, runs unit tests, and runs every repository-level Bats suite on every change.
- `rust-native.yml` — Rust product preflight for the native compiler kernel and CLI.
- `preflight.yml` — Repository hygiene checks (docs links, dependency boundaries, ESLint purity, license audit).
- Package workflows — focused checks for retained non-compiler packages such as Holmes.

Workflow names distinguish product checks from compatibility checks:

- `Rust Product ...` checks protect the native Rust product spine.
- `Repository Hygiene ...` checks protect repo coherence.
  Browser/Bun/Deno host experiment workflows are retired from the Wesley release
  surface.

## Reusable Pieces

### Install Bats (composite action)

`ci.yml` installs Bats, jq, and ripgrep with a composite action:

```yaml
- name: Install Bats
  uses: ./.github/actions/install-bats
```

Use it in any job that runs Bats suites on a Linux runner. ripgrep is a test
dependency, not a convenience: several suites assert that something is absent
with `run rg ...; assert_failure`. Without ripgrep that command exits 127, which
also satisfies `assert_failure`, so the assertion would pass having searched
nothing. Those suites load `test/helpers/require-ripgrep.bash` and refuse to run
when `rg` is not on `PATH`.

## Repo-level Bats Tests

`ci.yml` runs every suite under `test/*.bats` on every change, including the two
that start a local server. It discovers them by glob, so a new suite needs no
workflow edit, and a glob that matches nothing fails the step. All sixteen take
under a minute.

There is no path filter. An earlier version ran a listed subset only when a
diff touched certain paths. That diff was computed on a shallow checkout, failed
silently, and left the suites unselected, so in practice they did not run.

### Run these locally

```bash
pnpm run setup:bats-plugins
for f in test/*.bats; do BATS_LIB_PATH=test/vendor bats "$f"; done
```
