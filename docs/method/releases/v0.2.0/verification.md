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
- Release-prep merge: PR #655 merged to `main` at
  `8bc51a7b86d927ceaefec3630421699d68878242`.

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
| Release-prep merge state              | PR #655 landed the release-prep commit and docs CLI review fix on synced `main` at `8bc51a7b`.      |
| Open `v0.2.0` issue lane              | Only release gate #625 remained open during prep discovery.                                         |

## Docs Topics Audit

| Item             | Result                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope            | Every tracked file under `docs/topics/`.                                                                                                                                                                                                                                                                                                      |
| Accuracy score   | 100% for release-relevant topic claims audited during prep and the final pre-tag launch pass.                                                                                                                                                                                                                                                 |
| Coverage score   | 100% for release-relevant contributor/operator workflows changed by this release, including the explicit pre-tag signpost pass.                                                                                                                                                                                                               |
| Corrections made | Added pre-tag launch-pass coverage to `docs/topics/releases.md` and `docs/topics/docs-maintenance.md`; added the route to `docs/topics/README.md`; corrected pre-publication install wording in README, GUIDE, ENTRYPOINTS, docs site, and TECHNICAL_TEARDOWN; refreshed BEARING and docs front-door signposts for the `v0.2.0` launch state. |

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
| `cargo xtask docs-check` after launch signpost refresh                                            | Passed.                                                                                                        |
| `node scripts/check-doc-cli-commands.mjs` after launch signpost refresh                           | Passed.                                                                                                        |
| `cargo xtask release-prep-guard --version 0.2.0` after launch signpost refresh                    | Passed.                                                                                                        |
| `BATS_LIB_PATH=test/vendor bats -t test/release-governance.bats test/docs-planning-boundary.bats` | Passed after launch signpost refresh.                                                                          |
| `BATS_LIB_PATH=test/vendor bats -t test/technical-teardown.bats`                                  | Passed after removing stale pre-merge release blocker wording.                                                 |
| `node --test scripts/check-doc-cli-commands.test.mjs`                                             | Passed after removing Cargo/network dependency from docs CLI command discovery.                                |
| `node scripts/check-doc-cli-commands.mjs`                                                         | Passed after source-backed docs CLI command discovery fix.                                                     |
| `git diff --check` after launch signpost refresh                                                  | Passed.                                                                                                        |
| `cargo xtask preflight` after launch signpost refresh                                             | Passed.                                                                                                        |

## Release-Prep Notes

- The release branch and follow-up launch signpost pass update version-bearing
  manifests, README, CHANGELOG, docs topics, technical teardown, release packet
  docs, release notes, and stale signpost commands before tagging.
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
