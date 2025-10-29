# Wesley Test Suite

All automated tests live under `test/`. This guide explains prerequisites, local setup, how to run each suite in isolation, and where the fixtures live.

## Prerequisites

- Node.js ≥ 18.17 and `pnpm` (matching the repo’s `packageManager` field).
- `pnpm install` at the repository root to hydrate workspaces.
- The CLI end-to-end suites rely on [Bats](https://github.com/bats-core/bats-core). Install it locally (`brew install bats-core`, `apt install bats`, etc.) or rely on CI. Run `pnpm run setup:bats-plugins` once to vendor the required plugins.
- Docker is optional. The legacy `test/e2e/run-tests.sh` script can spin up Supabase via Docker but is not part of the default CI path.

For a full smoke run: `pnpm run bootstrap` (installs, preflight, workspace tests).

## Suites & Commands

| Test File | Run It With | Fixtures/Data | Recommended Environment |
| --- | --- | --- | --- |
| `test/cli-generators.bats` | `pnpm --filter @wesley/cli exec bats test/cli-generators.bats` | Creates temporary schema inline | Local Node runtime (no DB) |
| `test/cli-models.bats` | `pnpm --filter @wesley/cli exec bats test/cli-models.bats` | Creates temporary schema inline | Local Node runtime |
| `test/cli-e2e.bats` | `pnpm --filter @wesley/cli exec bats test/cli-e2e.bats` | `test/fixtures/rls-schema.graphql` | Local Node runtime (some tests skipped pending RLS rewrite) |
| `test/cli-e2e-real.bats` | `pnpm --filter @wesley/cli exec bats test/cli-e2e-real.bats` | `test/fixtures/rls-schema.graphql` | Local Node runtime; exercises `pnpm wesley` end-to-end |
| `test/holmes-e2e.bats` | `pnpm --filter @wesley/holmes exec bats test/holmes-e2e.bats` | `test/fixtures/examples/schema.graphql` | Local Node runtime |
| `test/e2e/run-tests.sh` | `bash test/e2e/run-tests.sh` | Creates its own minimal schema; legacy script expects Supabase via Docker | Optional / legacy — validate manually before relying on it |

### Notes

- All CLI Bats suites obey `WESLEY_REPO_ROOT` and use the fixtures described in `test/fixtures/README.md`.
- `test/e2e` is a historical harness that still references the old `example/` layout; treat it as a manual playground rather than part of the automated matrix.

## Fixture Layout

Fixtures power tests and documentation. Start with `test/fixtures/README.md`, which links to per-directory READMEs detailing coverage and consuming tests.

Highlights:

- `test/fixtures/examples/` – canonical GraphQL schemas used by docs and HOLMES tests.
- `test/fixtures/blade/` – Daywalker Deploys demo assets.
- `test/fixtures/postgres/` – SQL used by docker-compose jobs and CI Postgres setup.
- `test/fixtures/reference/` – rich SDL used for experiments or future tests.

## Package-Specific Tests

Workspace packages expose their own test commands:

- `pnpm --filter @wesley/core test`
- `pnpm --filter @wesley/cli test`
- `pnpm --filter @wesley/holmes test`
- `pnpm --filter @wesley/generator-js test`
- `pnpm --filter @wesley/generator-supabase test`

See the package READMEs for additional guidance. The `test/packages/` folder contains harnesses tailored to those packages; each directory now has its own README.

## CI/Coverage

GitHub Actions runs the relevant subsets:

- `.github/workflows/ci.yml` — main pipeline (unit + core checks).
- `.github/workflows/cli-tests.yml` — CLI bats suite.
- `.github/workflows/wesley-holmes.yml` — HOLMES evidence checks.
- `.github/workflows/preflight.yml` — hygiene checks (docs links, ESLint purity, dependency boundaries).

If a suite fails locally but passes in CI (or vice versa), ensure you have the prerequisites above and re-run with `pnpm run bootstrap` before filing an issue.
