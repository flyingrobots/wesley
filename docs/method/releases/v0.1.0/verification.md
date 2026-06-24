# Wesley v0.1.0 Verification

This packet records pre-release and publication evidence for `v0.1.0`.

## Release Inputs

- Target version: `0.1.0`.
- Target tag: `v0.1.0`.
- Prep branch: `feat/codec-plan`.
- Release type: pre-1.0 minor with a TypeScript generated decode API break.

## Local Evidence

| Check | Result |
| --- | --- |
| `cargo test -p wesley-emit-typescript -- le_binary --nocapture` | Passed during Slice 3 and Slice 4 validation. |
| `cargo test -p wesley-emit-typescript` | Passed during Slice 3 and Slice 4 validation. |
| `cargo test -p wesley-emit-rust` | Passed during Slice 4 validation. |
| `cargo test -p wesley-emit-rust -- le_binary --nocapture` | Passed during Slice 3 validation. |
| `cargo test -p wesley-emit-codec` | Passed during Slice 3 and Slice 4 validation. |
| TypeScript emitter CLI output compared against the golden fixture | Passed byte-identically during Slice 3 before the breaking Slice 4 change. |
| `cargo fmt --all -- --check` | Passed during Slice 3 and Slice 4 validation. |
| `cargo clippy -p wesley-emit-typescript --all-targets -- -D warnings` | Passed during Slice 3 and Slice 4 validation. |
| `cargo clippy -p wesley-emit-rust --all-targets -- -D warnings` | Passed during Slice 4 validation. |
| `cargo clippy -p wesley-emit-codec --all-targets -- -D warnings` | Passed during Slice 3 and Slice 4 validation. |
| `git diff --check` | Passed during Slice 3 and Slice 4 validation. |
| `cargo check -p wesley-cli` | Passed after the workspace version bump. |

## Release-Prep Checks

These checks were run during release preparation on `feat/codec-plan` and
refreshed on `main` before the release tag:

| Check | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Passed. |
| `git diff --check` | Passed. |
| `cargo xtask package-crates --version 0.1.0` | Passed after adding `wesley-emit-codec` to the publish set and adding its crate README. |
| `cargo xtask preflight` | Passed. Includes workspace clippy, pnpm audit, docs checks, workspace tests, doctests, and native CLI smoke. |
| `cargo xtask release-check` | Passed. Includes strict preflight, optimized CLI build/smoke, and `wesley-core` package check. |
| `cargo xtask release-prep-guard --version 0.1.0` | Passed on `main` after closing the obsolete #60 umbrella issue. |

## Tracker Refresh

The original release-prep run failed only on the live release umbrella:

- #60 release: plan and ship v0.1.0

That issue was a stale 2025 umbrella for an older meaning of `v0.1.0`. It was
closed as not planned on June 24, 2026, because the current release is governed
by this release packet, current release notes, the changelog, and the release
guard.

After #60 was closed, `cargo xtask release-prep-guard --version 0.1.0` passed
on `main`. The older noisy blocker set was triaged earlier. Satisfied or
obsolete items were closed; future Method backlog remains open but no longer
counts as release-lane ownership unless the issue title/body, milestone, or
label owns the exact tag or version. Third-party comments and automatic
cross-reference chatter are ignored.

## Final Signpost Refresh

On June 24, 2026, the release-facing signposts were refreshed after #60 was
closed so README, GUIDE, ENTRYPOINTS, ARCHITECTURE, TECHNICAL_TEARDOWN,
CHANGELOG, release packets, release runbooks, and xtask help all describe the
current `0.1.0` release scope.

Validation after that refresh:

| Check | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Passed. |
| `cargo xtask docs-check` | Passed. |
| `cargo test -p xtask` | Passed. |
| `cargo xtask release-prep-guard --version 0.1.0` | Passed. |
| `cargo xtask release-check` | Passed. |

## Publish Evidence

Publication was performed from the signed `v0.1.0` tag after PR #620 merged to
`main`. The tag-triggered Release Crates workflow completed successfully on
attempt 2. Attempt 1 stopped before publishing because a legacy shell guard
matched stale open issue comments; no crates were published before the retry.

| Item | Evidence |
| --- | --- |
| Release tag | `v0.1.0` tag object `94449806ab0b08c2023afe1721c9bcca83174188`; tag commit `214d27a94e4aa46614f32d18daf9827e5dfbd058`. |
| Tag signature | `git tag -v v0.1.0` reported a good signature from `James Ross <james@flyingrobots.dev>` using RSA key `01A63D8E9DBEEDE32918AF9C39560E0406CA9135`. |
| GitHub Release | `https://github.com/flyingrobots/wesley/releases/tag/v0.1.0`; published `2026-06-24T15:40:30Z`; not draft; not prerelease. |
| CI workflow | Tag CI run for `v0.1.0` completed successfully before the release rerun. |
| Crates workflow | `https://github.com/flyingrobots/wesley/actions/runs/28109147150`, attempt 2, completed successfully at `2026-06-24T15:40:35Z`. |
| Crates.io visibility | `cargo info` from outside the repository downloaded `wesley-core@0.1.0`, `wesley-emit-codec@0.1.0`, `wesley-emit-rust@0.1.0`, `wesley-emit-typescript@0.1.0`, and `wesley-cli@0.1.0` from crates.io. |

The crates.io API reported the following published versions, all not yanked:

| Crate | Version | Created at |
| --- | --- | --- |
| `wesley-core` | `0.1.0` | `2026-06-24T15:39:07.393094Z` |
| `wesley-emit-codec` | `0.1.0` | `2026-06-24T15:39:15.992300Z` |
| `wesley-emit-rust` | `0.1.0` | `2026-06-24T15:39:20.464557Z` |
| `wesley-emit-typescript` | `0.1.0` | `2026-06-24T15:39:23.559832Z` |
| `wesley-cli` | `0.1.0` | `2026-06-24T15:40:27.522439Z` |
