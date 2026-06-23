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
| `cargo xtask release-prep-guard --version 0.1.0` | Blocked by existing open GitHub issues that mention `v0.1.0`; see tracker blocker below. |

## Tracker Blocker

`cargo xtask release-prep-guard --version 0.1.0` passes local manifest and docs
checks, then fails the issue-tracker check because historical open issues still
mention the old `v0.1.0` lane. The guard reported these open issues:

- #549 Generator plugin docs use stale config shape
- #550 Preflight Latency Instrumentation
- #551 README release surface cleanup
- #552 Dependency audit release gate
- #554 Module load report release artifact
- #560 Generate execution orchestration split
- #561 Module loading structured diagnostics
- #565 Optic Artifact ID And Hash Semantics
- #566 Optic Authority Vocabulary Boundary
- #578 PR Feedback Session Witness
- #580 Holmes Comment Loader Policy Module
- #582 Review Supersession Explainer
- #587 EVIDENCE v2 certified evidence cutover and placeholder bundle removal
- #590 RUNTIME v2 transform runtime and ledger cutover
- #591 SOURCE v2 directive truth table and example boundary cleanup
- #595 WASM capability versioning and state
- #60 release: plan and ship v0.1.0

Do not cut the `v0.1.0` tag until those tracker references are closed,
retargeted, or otherwise deliberately cleared according to release policy.

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
