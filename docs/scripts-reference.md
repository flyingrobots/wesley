# Workspace Script Reference

Wesley uses `pnpm run <script>` to provide a common set of maintenance, test, and smoke-check commands. This guide explains what each script does, when to use it, and any notable side effects. You can view the authoritative list in `package.json`, but this document summarizes the intent.

> ℹ️ **Scope**: These scripts are intended to run from the repository root unless noted.

## Core Workflow Scripts

| Script                                                          | Purpose                                                                                                           | Notes                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run build`                                                | Run `build` in every workspace package.                                                                           | Uses `pnpm -r build`. Only packages that define a build script will execute.                                                                                                                                           |
| `pnpm run test`                                                 | Run the full test suite across the workspace.                                                                     | Invokes `pnpm -r test`. For targeted suites, use retained workspace filters such as `@wesley/holmes`.                                                                                                                  |
| `pnpm run test:watch` / `test:coverage`                         | Watch mode / coverage reporting across the workspace.                                                             | Useful during development; some packages may not implement these variants.                                                                                                                                             |
| `pnpm run lint` / `lint:fix`                                    | Repo-wide ESLint checks.                                                                                          | Defaults to ESLint running on `.js`/`.mjs` in the root workspace.                                                                                                                                                      |
| `pnpm run format` / `format:check`                              | Prettier formatting helpers.                                                                                      | `format` rewrites Prettier-owned source/docs/config files, `format:check` is read-only. Wesley SDL files, Rust IR goldens, and Rust-emitter TypeScript goldens are excluded because their bytes are compiler evidence. |
| `pnpm run validate`                                             | Convenience chain: `lint`, `format:check`, `test`.                                                                | Use before opening a PR.                                                                                                                                                                                               |
| `cargo xtask preflight`                                         | Rust product health check: docs hygiene, Node-retirement guards, Rust workspace tests, and native CLI help smoke. | Use this as the ordinary product gate before opening a PR.                                                                                                                                                             |
| `cargo xtask legacy-preflight`                                  | JavaScript-side hygiene checks for retained packages and docs helpers.                                            | Use when changing retained pnpm packages, package metadata, pnpm workspace files, or docs-command drift checks.                                                                                                        |
| `pnpm run legacy-preflight`                                     | Direct JavaScript bridge behind `cargo xtask legacy-preflight`.                                                   | Keeps docs links, dependency boundaries, package metadata, and license audit checks available for retained JavaScript tooling.                                                                                         |
| `pnpm run preflight`                                            | Compatibility alias for `cargo xtask preflight`.                                                                  | Kept for operator muscle memory; it is no longer the Node package preflight.                                                                                                                                           |
| `node scripts/pre-push-sanity.mjs --dry-run --files <paths...>` | Preview which sanity checks the smart pre-push hook would run for a change set.                                   | The tracked `.githooks/pre-push` delegates to this selector. Set `SKIP_PREPUSH_SANITY=1` to bypass everything and `SKIP_BATS_PREPUSH=1` to skip only the repo Bats lane.                                               |
| `pnpm run clean`                                                | Remove generated artifacts (`out/`, `.wesley-cache/`, coverage, etc.).                                            | See `scripts/clean.mjs` for the exact list.                                                                                                                                                                            |

## Project Maintenance

| Script                        | Purpose                                                          | Notes                                                   |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `pnpm run setup:bats-plugins` | Download/update vendored Bats plugins for repo-level Bats tests. | Safe to re-run; used during devcontainer bootstrapping. |
| `pnpm run meta:fix-packages`  | Normalize package metadata.                                      | Wraps `scripts/fix-package-metadata.mjs`.               |

## Progress & Badges

| Helper                         | Purpose                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/compute-progress.mjs` | Aggregates package status into `meta/progress.json`, updates README matrix and overall shields endpoint. | On local runs where `GITHUB_REPOSITORY` is unset, CI badge links are disabled and show an em dash (—) in the README table. `--dry-run` prints a summary without writing files. Missing package weights log a warning and default to `0.01` during weighted progress calculation. README markers are updated safely by re-locating indices after the matrix replacement. |

## Static Server

| Helper                     | Purpose                                   | Notes                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/serve-static.mjs` | Minimal static server used by unit tests. | Exports `contentType(file)` and `isWithinRoot(root, file)`. Path normalization decodes URIs and uses `path.relative` to prevent traversal; returns 403 on attempts to escape the root. Example: `node scripts/serve-static.mjs --dir=public --port=8787`. |

## Maintenance

| Helper                     | Purpose                                                   | Notes                                                                                          |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `scripts/tasks-update.mjs` | Recomputes the ASCII progress header in `tasks-clean.md`. | Calculates the percentage and bar based on tasks with `[!success]` + checked "Issue resolved". |

## Package-Specific Helpers

Some workspaces expose their own scripts via `pnpm --filter <package>`. Common examples:

| Command                             | Purpose                     | Notes                                          |
| ----------------------------------- | --------------------------- | ---------------------------------------------- |
| `pnpm --filter @wesley/holmes test` | Run Holmes assurance tests. | Holmes is retained outside compiler authority. |

## Tips

- Use `pnpm run <script> --help` if an underlying tool supports it (e.g., scripts that call CLI commands).
- `pnpm run` always executes from the repo root; organize per-package scripts under `pnpm --filter` when you need more granularity.
- Before adding new scripts, update this document so future contributors know what’s available.
