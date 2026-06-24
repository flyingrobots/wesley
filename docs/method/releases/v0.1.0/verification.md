# Wesley v0.1.0 Verification

This packet records pre-release evidence for `v0.1.0`. Publish evidence must be
appended after the signed tag, GitHub release, CI run, and crates.io
publication complete.

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

These checks were run during release preparation on `feat/codec-plan`:

| Check | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Passed. |
| `git diff --check` | Passed. |
| `cargo xtask package-crates --version 0.1.0` | Passed after adding `wesley-emit-codec` to the publish set and adding its crate README. |
| `cargo xtask preflight` | Passed. Includes workspace clippy, pnpm audit, docs checks, workspace tests, doctests, and native CLI smoke. |
| `cargo xtask release-check` | Passed. Includes strict preflight, optimized CLI build/smoke, and `wesley-core` package check. |
| `cargo xtask release-prep-guard --version 0.1.0` | Blocked only by the release umbrella #60 after issue-tracker triage; see tracker blocker below. |

## Tracker Blocker

`cargo xtask release-prep-guard --version 0.1.0` passes local manifest and docs
checks, then fails the issue-tracker check only for the live release umbrella:

- #60 release: plan and ship v0.1.0

The older noisy blocker set was triaged. Satisfied or obsolete items were
closed; future Method backlog remains open but no longer counts as release-lane
ownership unless the issue title/body, milestone, or label owns the exact tag or
version. Third-party comments and automatic cross-reference chatter are ignored.

Do not cut the `v0.1.0` tag until #60 is closed as part of the final release
handoff.

## Publish Evidence

Publication has not been performed in this branch. Append evidence here when
the release is cut:

| Item | Evidence |
| --- | --- |
| Release tag | Pending. |
| Tag signature | Pending. |
| GitHub Release | Pending. |
| CI workflow | Pending. |
| Crates workflow | Pending. |
| Crates.io visibility | Pending. |
