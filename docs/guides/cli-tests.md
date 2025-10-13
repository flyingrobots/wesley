# CLI Tests and Workflows

Wesley’s CLI tests run in dedicated GitHub Actions workflows:

- Quick CLI Check (fast smoke on Ubuntu)
- CLI End‑to‑End Tests (Ubuntu matrix for Node 18/20/22)

We use Bats for shell‑driven CLI tests. Locally, run `pnpm -C packages/wesley-cli test`. CI adds Bats via the workflow and verifies basic commands, help/version, and generation paths.

Note: macOS runners are removed to control Actions costs; our CLI tests are platform‑agnostic and run fine on Ubuntu.

