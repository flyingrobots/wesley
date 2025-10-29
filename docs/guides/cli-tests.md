# CLI Tests and Workflows

Wesley’s CLI tests run in dedicated GitHub Actions workflows:

- Quick CLI Check (fast smoke on Ubuntu)
- CLI End‑to‑End Tests (Ubuntu matrix for Node 18/20/22)

We use Bats for shell‑driven CLI tests. Locally, run `pnpm -C packages/wesley-cli test`. CI adds Bats via the workflow and verifies basic commands, help/version, and generation paths.

Note: macOS runners are removed to control Actions costs; our CLI tests are platform‑agnostic and run fine on Ubuntu.

## Local Setup

1. Install prerequisites:
   - Node 18+ with Corepack enabled (repo pins pnpm 9.15.9)
   - `bats`, `jq`, and `git` in your shell environment
2. Vendor the Bats plugins with `pnpm run setup:bats-plugins`.
3. Run the suite with `pnpm --filter @wesley/cli test` or `./packages/wesley-cli/test/run-bats.sh`.

The test runner creates and destroys temporary directories for each test, so your working tree stays untouched. Failures simply leave behind the temp directory data for debugging.

## Dev Container

Open the repository with VS Code’s Dev Containers extension (or `devcontainer open`) to use the turnkey environment defined in `.devcontainer/`. The container:

- Installs Node 20, pnpm, bats, jq, and PostgreSQL client binaries
- Runs `pnpm install` and `pnpm run setup:bats-plugins` automatically
- Leaves room to add a PostgreSQL service + pgTAP for future generated-test coverage

Once the container starts, run `pnpm --filter @wesley/cli test` and `pnpm run preflight` for parity with CI.
