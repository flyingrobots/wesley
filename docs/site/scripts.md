---
title: Workspace Scripts
---

<!-- docs-truth: status=current owner=@flyingrobots -->

# Workspace Scripts

Wesley exposes a handful of `pnpm run <script>` commands for common workflows. This page mirrors the content in `docs/scripts-reference.md` so the MkDocs site stays in sync.

> ℹ️ **Where to run these**: Unless noted, execute all scripts from the repository root.

## Core Workflow Scripts

| Script                                          | Purpose                                                                         | Notes                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm run build`                                | Run `build` in every workspace package.                                         | Uses `pnpm -r build`; only packages that define `build` will execute.                                  |
| `pnpm run test`                                 | Run the full workspace test suite.                                              | Equivalent to `pnpm -r test`.                                                                          |
| `pnpm run test:watch`, `pnpm run test:coverage` | Watch mode / coverage runs.                                                     | Provided where individual packages support them.                                                       |
| `pnpm run lint`, `pnpm run lint:fix`            | Repo-wide ESLint checks.                                                        | The `--fix` variant applies automatic fixes.                                                           |
| `pnpm run format`, `pnpm run format:check`      | Prettier formatting helpers.                                                    | `format` rewrites Prettier-owned files; SDL and Rust IR goldens stay under compiler/generator control. |
| `pnpm run validate`                             | Runs lint → format check → test.                                                | Good pre-PR smoke check.                                                                               |
| `pnpm run preflight`                            | Docs link validation, dependency boundaries, ESLint core purity, license audit. | Mirrors the CI preflight job.                                                                          |
| `pnpm run clean`                                | Remove generated artifacts (`out/`, `.wesley-cache/`, etc.).                    | See `scripts/clean.mjs` for the full list.                                                             |

## Maintenance & Tooling

| Script                        | Purpose                                      | Notes                                                                   |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm run setup:bats-plugins` | Download/update vendored Bats plugins.       | Needed for CLI Bats tests (runs automatically inside the devcontainer). |
| `pnpm run meta:fix-packages`  | Normalize workspace `package.json` metadata. | Wraps `scripts/fix-package-metadata.mjs`.                               |

## Package-Specific Commands

Use `pnpm --filter <package> <script>` for package-level tasks. Common examples:

- `pnpm --filter @wesley/cli test` – run the CLI Bats suite.
- `pnpm --filter @wesley-core test:unit` – run core unit tests.
- `pnpm --filter @wesley-core test:property` – run property-based tests.

Refer to each package’s `package.json` for the full list of available scripts.
