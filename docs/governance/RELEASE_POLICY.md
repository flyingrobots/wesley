# Release Policy

<!-- docs-truth: status=current owner=@flyingrobots -->

This document is the canonical gate policy for Wesley releases. Every release
must clear all automated checks and all human sign-offs before a tag is
considered valid and the publish workflow is permitted to run.

## Enforcement

Release gates are split between automated machinery and human review. Neither
can substitute for the other. A release that clears all automated checks but
lacks the human sign-off is not a valid release, and vice versa.

- **Automated checks** run inside `cargo xtask release-guard --tag vX.Y.Z`.
  The CI publish workflow calls this command before uploading anything. A
  nonzero exit code blocks the publish. The release guard calls the same strict
  preflight gate developers run locally: `cargo xtask preflight`.
- **Release artifact checks** run through `cargo xtask release-check`. This
  command first runs strict preflight, then builds and smokes the optimized
  native CLI and packages release artifacts without publishing anything.
- **Human sign-off** is collected on the release PR using the template in
  [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md). The checklist must be
  completed by a human reviewer before the tag is created.

## Enforcement Matrix

| #   | Check                                                | Automated      | Human    |
| --- | ---------------------------------------------------- | -------------- | -------- |
| 1   | Zero open `lane:asap` GitHub issues                  | `xtask` + `gh` |          |
| 2   | Zero open version-lane issues                        | `xtask` + `gh` |          |
| 3   | Strict preflight gate                                | `xtask`        |          |
| 4   | Zero open issues from prior-version lanes            | `gh`           |          |
| 5   | Version lockstep across all `Cargo.toml` manifests   | parse          |          |
| 6   | `CHANGELOG.md` has a dated entry for this version    | parse          |          |
| 7   | `CHANGELOG.md` reflects actual diff vs. prior tag    |                | reviewer |
| 8   | `README.md` version headline matches tag             | grep           |          |
| 9   | `docs/TECHNICAL_TEARDOWN.md` references tag version  | grep           |          |
| 10  | `docs/ARCHITECTURE.md` is current                    |                | reviewer |
| 11  | Guide file paths resolve to existing repo paths      | grep + stat    |          |
| 12  | Guide cited commit SHAs exist in git history         | git cat-file   |          |
| 13  | Guide claims are accurate                            |                | reviewer |
| 14  | `docs-truth` manifest passes                         | `xtask`        |          |
| 15  | `cargo audit` reports zero vulnerabilities           | shell          |          |
| 16  | No WIP or `fixup!` commits in release range          | git log        |          |
| 17  | Working tree is clean                                | git status     |          |
| 18  | Tag commits to `main`                                | git branch     |          |
| 19  | CI is green on HEAD at tag time                      | `gh` API       |          |
| 20  | `BREAKING CHANGE` commits → major/minor version bump | git log        |          |
| 21  | `cargo doc --workspace` builds with zero warnings    | cargo doc      |          |
| 22  | No known issues silently shipped                     |                | reviewer |

## Automated Checks — Details

### Check 1–4: Issue Tracker

`cargo xtask release-guard` calls the GitHub CLI to list open issues:

- **Check 1** — `lane:asap`: any open issue with this label blocks the release
  regardless of version affinity.
- **Check 2** — Version-lane issues: open issues labeled with the release tag
  (e.g. `v0.1.0`) or matching the version string in title or body.
- **Check 4** — Prior-version issues: open issues from older version lanes
  (older SemVer milestone or label matches) that were never closed.

### Check 3: Strict Preflight Gate

`cargo xtask preflight` is the shared pre-PR and release truth. It must exit 0
before a PR is considered ready and before a release tag can publish. The gate
runs, in order:

1. `cargo fmt --check`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `pnpm audit --prod=false --json`
4. `cargo xtask docs-check`
5. `cargo test --workspace`
6. `cargo run --bin wesley -- --help`

`cargo xtask strict-preflight` is an explicit alias for the same gate.
`cargo xtask release-check` starts with the same gate before building release
artifacts.

### Check 5: Version Lockstep

All `Cargo.toml` manifests for published crates must declare the same version
as the release tag. Workspace members are not permitted to drift independently.

### Check 6: Changelog

`CHANGELOG.md` must contain a section heading of the form
`## [{version}] - YYYY-MM-DD` where `{version}` matches the tag (without the
leading `v`). A section heading without a date is rejected.

### Check 8: README Headline

`README.md` must contain the exact heading `## What's New in v{version}`.
If the README still refers to a prior release version in that heading, the
check fails.

### Check 9: TECHNICAL_TEARDOWN

`docs/TECHNICAL_TEARDOWN.md` must contain `v{version}` as a whole version
reference (not as a substring of a longer version string). This document is
updated each release to describe the current state; a stale reference is a
sign the document was not updated.

### Check 11: Guide File Paths

Backtick-wrapped strings in `docs/guides/` that look like repository-relative
file paths (e.g., `` `crates/wesley-core/src/lib.rs` ``) must resolve to
existing files or directories under the repository root. A guide that cites a
path that was moved or deleted must be updated before release.

### Check 12: Guide Cited SHAs

Full 40-character commit SHAs appearing in backticks inside `docs/guides/` must
exist in git history (`git cat-file -e <sha>`). A guide citing a commit that
was squashed, force-pushed out, or never existed fails this check.

### Check 14: docs-truth

The `docs/truth-manifest.json` must be consistent: every entry must point to a
file that exists and whose embedded `docs-truth` metadata comment matches the
manifest fields. All public mkdocs nav pages must appear in the manifest.

### Check 15: cargo audit

`cargo audit` must report zero known vulnerabilities. Advisories for
dev-dependencies are included. The check is not skippable at release time.
Install `cargo-audit` with `cargo install cargo-audit` if not present. This is
the Rust advisory database check; the pnpm advisory check is part of strict
preflight.

### Check 16: No WIP or fixup! Commits

`git log {prev-tag}..{tag} --format=%s` must not contain any subject lines
starting with `WIP` or `fixup!`. The presence of such commits indicates a
history that was not cleaned up before tagging.

### Check 17: Working Tree is Clean

`git status --porcelain` must return no output. Uncommitted changes at tag
time indicate the tag does not represent a clean, reproducible state.

### Check 18: Tag on main

The tag's commit must be reachable from `origin/main`
(`git merge-base --is-ancestor`). Releases from feature branches are not
permitted.

### Check 19: CI Green

At the time the release-guard runs, all GitHub Actions workflow runs on HEAD
must have `conclusion=success` (or `skipped`/`neutral` for non-blocking
checks). A pending or failed run blocks the release. When the guard runs from
the tag-triggered release workflow, that current workflow run is excluded from
the pending-run check so the release workflow does not fail by observing itself.

### Check 20: BREAKING CHANGE → Version Bump

If any commit in the release range contains `BREAKING CHANGE` in its body, the
version must be a major or minor bump from the previous tag. A breaking change
shipped as a patch release is rejected.

### Check 21: cargo doc

`cargo doc --workspace --no-deps` must compile with zero warnings under
`RUSTDOCFLAGS="-D warnings"`. Public API documentation must not silently rot.

## Human Sign-Off — Details

### Check 7: CHANGELOG Reflects Actual Diff

A human reviewer must diff the release against the previous tag
(`git log {prev-tag}..{tag} --oneline`) and confirm that the CHANGELOG entry
accounts for all user-visible changes. Machine checks cannot detect a CHANGELOG
entry that is technically present but misleadingly incomplete.

### Check 10: ARCHITECTURE.md Current

A human reviewer must read `docs/ARCHITECTURE.md` and confirm it accurately
describes the current repository structure, crate relationships, and ownership
boundaries. Stale architecture docs are a silent onboarding hazard.

### Check 13: Guide Claims Accurate

A human reviewer must spot-check the affected guides from `docs/guides/` to
confirm that commands, file paths, and behavioral claims are accurate against
the current codebase. Automated checks confirm files exist and SHAs resolve;
they cannot confirm that a claimed behavior actually works.

### Check 22: No Known Issues Silently Shipped

A human reviewer must confirm that no open GitHub Issues represent known defects
or outstanding decisions that affect this release's correctness or safety, and
are being knowingly shipped without acknowledgment in the CHANGELOG or a
documented follow-on issue. Automated issue-tracker checks surface issues by
version label and milestone; they cannot detect an issue that was never labeled
but is nonetheless blocking.

## Policy Violations

If a release is discovered to have shipped in violation of this policy:

1. File a `lane:asap` GitHub Issue immediately documenting the violation.
2. Do not attempt to retroactively fix the published crate — crates.io publishes
   are permanent.
3. If the violation involves a security defect, follow `SECURITY.md`.
4. Issue a corrective patch release at the earliest opportunity.
5. Post-mortem the gate failure and update xtask checks to prevent recurrence.
