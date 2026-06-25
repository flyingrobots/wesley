# CLI Tests and Workflows

Wesley's product CLI tests are Rust-native. The retired JavaScript CLI workflows
and package-local Bats suite were deleted with the legacy Node surface.

Primary checks:

- `cargo test --workspace`
- `cargo xtask preflight`
- `cargo wesley --help`
- repo-level Bats smoke files under `test/`

Use package-local `pnpm --filter ... test` only for retained JavaScript
packages such as `@wesley/holmes` or the host experiments.

## Local Setup

1. Install prerequisites:
   - Node 22+ with Corepack enabled (repo pins pnpm 9.15.9)
   - Rust stable, `bats`, `jq`, and `git` in your shell environment
2. Verify the vendored Bats plugins with `pnpm run setup:bats-plugins`.
3. Run the product gate with `cargo xtask preflight`.
4. Run repo-level Bats smokes directly when changing shell harnesses, for
   example `BATS_LIB_PATH=test/vendor bats -t test/ci-workflows.bats`.

The test runner creates and destroys temporary directories for each test, so your working tree stays untouched. Failures simply leave behind the temp directory data for debugging.

## Dev Container

Open the repository with VS Code’s Dev Containers extension (or `devcontainer open`) to use the turnkey environment defined in `.devcontainer/`. The container:

- Installs Node 22, pnpm, bats, jq, and PostgreSQL client binaries
- Runs `pnpm install` and verifies vendored Bats plugins automatically
- Leaves room to add a PostgreSQL service + pgTAP for future generated-test coverage

Once the container starts, run `cargo xtask preflight` for Rust product parity
with CI. Run retained JavaScript package tests only when you change those
packages.
