# Workspace Script Reference

Wesley uses `pnpm run <script>` to provide a common set of maintenance, test, and smoke-check commands. This guide explains what each script does, when to use it, and any notable side effects. You can view the authoritative list in `package.json`, but this document summarizes the intent.

> ℹ️ **Scope**: These scripts are intended to run from the repository root unless noted.

## Core Workflow Scripts

| Script | Purpose | Notes |
| --- | --- | --- |
| `pnpm run build` | Run `build` in every workspace package. | Uses `pnpm -r build`. Only packages that define a build script will execute. |
| `pnpm run test` | Run the full test suite across the workspace. | Invokes `pnpm -r test`. For targeted suites see the CLI or core packages directly. |
| `pnpm run test:watch` / `test:coverage` | Watch mode / coverage reporting across the workspace. | Useful during development; some packages may not implement these variants. |
| `pnpm run lint` / `lint:fix` | Repo-wide ESLint checks. | Defaults to ESLint running on `.js`/`.mjs` in the root workspace. |
| `pnpm run format` / `format:check` | Prettier formatting helpers. | `format` rewrites files, `format:check` is read-only. |
| `pnpm run validate` | Convenience chain: `lint`, `format:check`, `test`. | Use before opening a PR. |
| `pnpm run preflight` | Repository hygiene checks (docs links, dependency boundaries, ESLint core purity, license audit). | Mirrors the CI preflight workflow. |
| `pnpm run clean` | Remove generated artifacts (`out/`, `.wesley/`, coverage, etc.). | See `scripts/clean.mjs` for the exact list. |

## Project Maintenance

| Script | Purpose | Notes |
| --- | --- | --- |
| `pnpm run setup:bats-plugins` | Download/update vendored Bats plugins for CLI tests. | Safe to re-run; used during devcontainer bootstrapping. |
| `pnpm run meta:fix-packages` | Normalize package metadata. | Wraps `scripts/fix-package-metadata.mjs`. |
| `pnpm run docker:up` / `docker:down` | Bring up / tear down the docker-compose stack. | Good for manual Postgres testing. |
| `pnpm run docker:test` | Run pgTAP tests inside docker-compose. | Executes the `pgtap` service defined in compose. |

## Test Harnesses

| Helper | Purpose | Notes |
| --- | --- | --- |
| `scripts/host_contracts_runner.mjs` | Shared runner used by Node, Deno, and Bun host‑contract entrypoints. | Emits a single JSON result and sets exit code (0 when `failed === 0`). Entry scripts (`host_contracts_node.mjs`, `host_contracts_deno.mjs`, `host_contracts_bun.mjs`) simply `import { runAndReport }` and await it. |
| `scripts/host_contracts_browser.mjs` | Builds the contracts bundle (Vite), serves it, runs Playwright, and prints JSON. | Honors `OUT_JSON`. When `ONLY_PARSE_OUT_JSON=1`, skips build/serve and only parses the file (useful for debugging). Logs verifyIr diagnostics to stderr when failures occur. |

## Progress & Badges

| Helper | Purpose | Notes |
| --- | --- | --- |
| `scripts/compute-progress.mjs` | Aggregates package status into `meta/progress.json`, updates README matrix and overall shields endpoint. | On local runs where `GITHUB_REPOSITORY` is unset, CI badge links are disabled and show an em dash (—) in the README table. `--dry-run` prints a summary without writing files. Missing package weights log a warning and default to `0.01` during weighted progress calculation. README markers are updated safely by re-locating indices after the matrix replacement. |

## Static Server

| Helper | Purpose | Notes |
| --- | --- | --- |
| `scripts/serve-static.mjs` | Minimal static server for browser smokes. | Exports `contentType(file)` and `isWithinRoot(root, file)`. Path normalization decodes URIs and uses `path.relative` to prevent traversal; returns 403 on attempts to escape the root. |

## Maintenance

| Helper | Purpose | Notes |
| --- | --- | --- |
| `scripts/tasks-update.mjs` | Recomputes the ASCII progress header in `tasks-clean.md`. | Calculates the percentage and bar based on tasks with `[!success]` + checked "Issue resolved". |

## Smoke Checks

| Script | Purpose | Notes |
| --- | --- | --- |
| `pnpm run smoke:postgres-fixture` | Verify that the Postgres init fixture mounts and seeds correctly. | Starts a disposable container using `docker-compose.fixture-test.yml`, checks extensions, then tears down. |

## Package-Specific Helpers

Some workspaces expose their own scripts via `pnpm --filter <package>`. Common examples:

| Command | Purpose | Notes |
| --- | --- | --- |
| `pnpm --filter @wesley/cli test` | Run the CLI Bats suite. | Automatically used in CI (and preflight). |
| `pnpm --filter @wesley-core test:<variant>` | Run core unit/coverage/property tests. | See `packages/wesley-core/package.json` for the full list. |

## Tips

- Use `pnpm run <script> --help` if an underlying tool supports it (e.g., scripts that call CLI commands).
- `pnpm run` always executes from the repo root; organize per-package scripts under `pnpm --filter` when you need more granularity.
- Before adding new scripts, update this document so future contributors know what’s available.
