# Repository Scripts

This directory contains helper scripts that power development workflows. Run them from the repository root unless otherwise noted.

| Script | Description | Usage |
| --- | --- | --- |
| `check-doc-links.mjs` | Scans every markdown file for relative links that point to missing targets. Fails with a non-zero exit code if any are broken. | `pnpm exec node scripts/check-doc-links.mjs` (no arguments) |
| `clean.mjs` | Removes generated artifacts such as `.wesley/`, `out/`, and fixture outputs to return the workspace to a pristine state. | `pnpm run clean` (no arguments) |
| `fix-package-metadata.mjs` | Normalises `package.json` metadata across all workspaces (author, license, repository, etc.). | `pnpm exec node scripts/fix-package-metadata.mjs` (no arguments) |
| `install-hooks.sh` | Sets `core.hooksPath` to `.githooks`, ensuring local Git hooks run. Safe to rerun. | `bash scripts/install-hooks.sh` |
| `preflight.mjs` | Runs the repository hygiene suite (docs link check, dependency boundaries, ESLint purity, license audit). | `pnpm run preflight` – respects `SKIP_PREFLIGHT=1` to bypass |
| `setup-bats-plugins.sh` | Installs pinned Bats testing plugins into `packages/wesley-cli/test/bats-plugins`. | `bash scripts/setup-bats-plugins.sh` |
| `test-ci-locally.sh` | Simulates the GitHub Actions CLI job locally (installs deps, runs Bats, emits TAP). | `pnpm run test:ci:local` |
| _(composite)_ | Convenience bootstrap script that installs dependencies, runs preflight, then runs the workspace tests. | `pnpm run bootstrap` |

> [!tip]
> All scripts assume Node 18+ and `pnpm` (pinned via `package.json`). Use `pnpm exec` to ensure the local toolchain is picked up.
