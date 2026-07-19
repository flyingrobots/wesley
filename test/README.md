# Wesley Test Suite

All automated tests live under `test/`. This guide explains prerequisites, local setup, how to run each suite in isolation, and where the fixtures live.

## Prerequisites

- Node.js ≥ 18.17 and `pnpm` (matching the repo’s `packageManager` field).
- `pnpm install` at the repository root to hydrate workspaces.
- Repo-level suites rely on [Bats](https://github.com/bats-core/bats-core). Install it locally (`brew install bats-core`, `apt install bats`, etc.) or rely on CI. Vendored helper plugins live under `test/vendor/bats-plugins`; run `pnpm run setup:bats-plugins` to verify them.

For a full smoke run: `pnpm run bootstrap` (installs, preflight, workspace tests).

## Suites & Commands

| Test File              | Run It With                                              | Fixtures/Data                   | Recommended Environment |
| ---------------------- | -------------------------------------------------------- | ------------------------------- | ----------------------- |
| `test/holmes-e2e.bats` | `BATS_LIB_PATH=test pnpm exec bats test/holmes-e2e.bats` | Generated SHIPME fixture bundle | Local Node runtime      |

### Notes

- Repo-level Bats suites use the fixtures described in `test/fixtures/README.md`.

## Fixture Layout

Fixtures power tests and documentation. Start with `test/fixtures/README.md`, which links to per-directory READMEs detailing coverage and consuming tests.

Highlights:

- `test/fixtures/examples/` – canonical GraphQL schemas used by docs and HOLMES tests.
- `test/fixtures/blade/` – Daywalker Deploys demo assets.
- `test/fixtures/reference/` – rich SDL used for experiments or future tests.

## Package-Specific Tests

Workspace packages expose their own test commands:

- `pnpm --filter @wesley/holmes test`

See the package READMEs for additional guidance.

## CI/Coverage

GitHub Actions runs the relevant subsets:

- `.github/workflows/ci.yml` — main pipeline.
- `.github/workflows/wesley-holmes.yml` — HOLMES evidence checks.
- `.github/workflows/preflight.yml` — hygiene checks (docs links, ESLint purity, dependency boundaries).

### Repo-level Bats tests (server/docs/CI checks)

These small suites are gated in CI and only run when relevant files change. To run locally:

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

If a suite fails locally but passes in CI (or vice versa), ensure you have the prerequisites above and re-run with `pnpm run bootstrap` before filing an issue.
