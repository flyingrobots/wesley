# Leaf Package Deletion Audit

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This audit records the NR-082 through NR-094 cleanup tranche. The later final
closeout is recorded in
[`FINAL_CLOSEOUT.md`](./FINAL_CLOSEOUT.md).

## Deleted Packages

| Slice  | Package                                 | Outcome | Replacement / owner                                                                                                        |
| ------ | --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| NR-082 | `packages/wesley-scaffold-multitenant/` | Deleted | Product scaffold ownership belongs in a product repository, not generic Wesley.                                            |
| NR-083 | `packages/wesley-test-fixtures/`        | Deleted | Useful fixtures live as plain `test/fixtures` files or Rust test assets.                                                   |
| NR-084 | `packages/wesley-tasks/`                | Deleted | Wesley keeps task graph descriptors in core; scheduling/execution policy belongs to Rust or external runtimes once proved. |

## Cleanup Evidence

| Slice  | Evidence                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------- |
| NR-085 | Deleted package directories no longer contain `package.json`, so the `packages/*` workspace glob no longer admits them. |
| NR-086 | Removed the dead optional `@wesley/tasks` load from `createNodeRuntime()` and removed package-only test wiring.         |
| NR-087 | Regenerated `pnpm-lock.yaml` with the deleted package importers removed.                                                |
| NR-088 | Deleted `.github/workflows/pkg-tasks.yml`; no package-only workflow remains for a deleted surface.                      |

## Preserved JavaScript Tooling

| Slice  | Decision                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NR-089 | JavaScript remains for repository tooling, docs/site generation, and legacy compatibility lanes. It is not product compiler authority.                                      |
| NR-090 | `@git-stunts/alfred` remains a root dev dependency only for JavaScript tooling seams that run bounded child processes.                                                     |
| NR-091 | `ninelives` remains the Rust resilience primitive in `crates/wesley-core` and `xtask`; it is the chosen policy library for cooperative Rust compiler and capability seams. |

## Stale Shadow Audit

The stale-package search intentionally still finds historical or retired
references in changelog entries, graveyard notes, the retirement ledger, and
this audit. It must not find a live package directory, package workflow, active
progress row, or code path that imports the deleted packages as runtime
dependencies.

Allowed remaining references:

- `CHANGELOG.md` historical entries.
- Current docs whose purpose is to state retired package status:
  `docs/ARCHITECTURE.md`, `docs/LEGACY_NODE_MIGRATION.md`,
  `docs/WESLEY_GLOSSARY.md`, `docs/architecture/transmutations.md`, and
  `docs/design/wesley-extraction-map.md`.
- `docs/design/0017-rust-native-front-door-and-node-retirement/` package
  retirement rows and this audit.
- `docs/method/graveyard/` archived backlog notes.
- `CHRONICLES_OF_THE_MACHINE-KIND_*.jsonl` historical machine logs.
- Tests that assert deleted package names no longer appear in active workflow
  requirements.

Active-surface search over manifests, workspace config, then-current progress
metadata,
`.github/`, `test/`, `packages/`, `crates/`, `scripts/`,
`docs/truth-manifest.json`, and active backlog lanes finds no manifest,
workflow, script, import, dynamic import, or runtime dependency on the deleted
packages. Broad text search still finds one pre-existing legacy-core comment
that states the task graph descriptor has no dependency on the deleted task
package; the retirement guard intentionally keeps that file unchanged until the
larger `wesley-core` deletion/extraction gate closes.

## Remaining Open Gates

None in the legacy Node retirement campaign. NR-076 through NR-079 were closed
by deleting the final compatibility packages, and NR-095/NR-096 are closed by
the final closeout.

## Verification

| Command                         | Result |
| ------------------------------- | ------ |
| `git diff --check`              | Pass   |
| `cargo xtask docs-check`        | Pass   |
| `pnpm run lint:docs-whitespace` | Pass   |
| `pnpm run format:check`         | Pass   |
| `pnpm run lint`                 | Pass   |
| `pnpm test`                     | Pass   |
| `pnpm run preflight`            | Pass   |
| `cargo xtask legacy-preflight`  | Pass   |
| `cargo xtask preflight`         | Pass   |
| `cargo xtask release-check`     | Pass   |
