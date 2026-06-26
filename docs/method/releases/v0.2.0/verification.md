# Wesley v0.2.0 Verification

This packet records pre-release evidence for `v0.2.0`.

Publication evidence is intentionally not prefilled in the repository before the
tag exists. After the signed tag publishes, the authoritative post-publish
evidence lives in the GitHub Release, tag workflow logs, crates.io, and direct
registry checks; release truth must not depend on a post-publish backfill merge.

## Release Inputs

- Target version: `0.2.0`.
- Target tag: `v0.2.0`.
- Prep branch: `release/v0.2.0`.
- Release type: pre-1.0 minor with new public project-manifest and config CLI
  surfaces.
- Previous release tag: `v0.1.1`.
- Release gate: GitHub issue #625, milestone `Release: v0.2.0`.
- Release boundary: signed tag from synced `main` only.

## Discovery

| Fact                                  | Result                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Repository type                       | Mixed Rust/pnpm workspace.                                                                          |
| Rust release authority                | `wesley-core`, `wesley-emit-codec`, `wesley-emit-rust`, `wesley-emit-typescript`, and `wesley-cli`. |
| Unpublished Rust workspace member     | `wesley-holmes` stays `publish = false` but follows workspace version lockstep.                     |
| Package manager                       | pnpm `9.15.9` from root `packageManager`.                                                           |
| Node requirement                      | `>=22.12.0` from root `package.json`.                                                               |
| Latest prior semver tag               | `v0.1.1`.                                                                                           |
| Main sync state before release branch | Local `main` matched `origin/main` at merge commit `03d527855e740c456f5f71f9c763ab071a5ddd1b`.      |
| Open `v0.2.0` issue lane              | Only release gate #625 remained open during prep discovery.                                         |

## Docs Topics Audit

| Item             | Result                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope            | Every tracked file under `docs/topics/`.                                                                                                                                                                                                                                                                                                                           |
| Accuracy score   | 100% for release-relevant topic claims audited during prep.                                                                                                                                                                                                                                                                                                        |
| Coverage score   | 100% for release-relevant contributor/operator workflows changed by this release.                                                                                                                                                                                                                                                                                  |
| Corrections made | No `docs/topics/` page required content correction after audit. Related stale signposts and command-checker behavior were corrected outside `docs/topics/`: docs site install/quick-start claims, technical teardown command/version claims, release indexes, legacy backlog signpost examples, and `scripts/check-doc-cli-commands.mjs` command-family detection. |

## Local Evidence

| Check                                                                                             | Result                                                                                                         |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `git status --porcelain` before release branch edits                                              | Passed: clean.                                                                                                 |
| `git fetch origin`                                                                                | Passed.                                                                                                        |
| `cargo xtask release-check` on pre-bump `main`                                                    | Passed for the published `0.1.1` state before release prep edits.                                              |
| `cargo xtask release-prep-guard --version 0.2.0` before version bump                              | Failed as expected because manifests still declared `0.1.1`.                                                   |
| `node scripts/check-doc-cli-commands.mjs`                                                         | Passed after command-family checker update.                                                                    |
| `cargo xtask docs-check`                                                                          | Passed.                                                                                                        |
| `cargo xtask release-prep-guard --version 0.2.0` after version bump                               | Passed after tracker and legacy backlog signpost cleanup.                                                      |
| `cargo xtask preflight`                                                                           | Passed.                                                                                                        |
| `cargo xtask release-check`                                                                       | Passed.                                                                                                        |
| `cargo xtask package-crates --version 0.2.0`                                                      | Passed for `wesley-core`, `wesley-emit-codec`, `wesley-emit-rust`, `wesley-emit-typescript`, and `wesley-cli`. |
| `cargo doc --workspace --no-deps` with `RUSTDOCFLAGS=-D warnings`                                 | Passed.                                                                                                        |
| `BATS_LIB_PATH=test/vendor bats -t test/release-governance.bats test/docs-planning-boundary.bats` | Passed.                                                                                                        |
| `pnpm exec prettier --check ...` on changed docs/scripts/metadata                                 | Passed after formatting the new release packet files.                                                          |
| `cargo run --bin wesley -- --version`                                                             | Passed, printing `0.2.0`.                                                                                      |
| `cargo test --workspace -- --list`                                                                | Passed for discovery; current workspace lists 323 Rust tests.                                                  |

## Release-Prep Notes

- The release branch updates version-bearing manifests, README, CHANGELOG,
  technical teardown, release packet docs, release notes, and stale signpost
  commands before tagging.
- The project-manifest surface stays domain-free: schema sets, rebuild globs,
  bundle locations, comment mode, dashboards, and generic target descriptors
  are structure and metadata only.
- Postgres, Echo, Continuum, renderer, Vite, Vue, website, playground, and host
  behavior remain outside Wesley core.
- GitHub issue #625 remains open as the release-gate issue in the
  `Release: v0.2.0` milestone, but it no longer carries a concrete `v*`
  implementation scheduling label or exact-version title/body text that would
  make `release-prep-guard` treat the gate as unfinished implementation work.
- GitHub issue #646 was refreshed so its living contributor-onramp text no
  longer owns the current release token. GitHub issue #649 had the stale
  `triage:cool-ideas` label removed because it is already scheduled for a
  named future release.

## Publish Evidence

Pending until `v0.2.0` is signed on synced `main` and pushed.
