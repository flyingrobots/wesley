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
  nonzero exit code blocks the publish.
- **Human sign-off** is collected on the release PR using the template in
  [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md). The checklist must be
  completed by a human reviewer before the tag is created.

## Enforcement Matrix

| Check | Automated | Human |
|---|---|---|
| Zero open `lane:asap` GitHub issues | `xtask` + `gh` | |
| Zero open version-lane issues | `xtask` + `gh` | |
| Zero failing workspace tests | `cargo test` | |
| Zero open issues from prior-version lanes | `gh` | |
| Version lockstep across all `Cargo.toml` manifests | parse | |
| `CHANGELOG.md` has a dated entry for this version | parse | |
| `CHANGELOG.md` reflects actual diff vs. prior tag | | reviewer |
| `README.md` version headline matches tag | grep | |
| `docs/TECHNICAL_TEARDOWN.md` references tag version | grep | |
| `docs/ARCHITECTURE.md` is current | | reviewer |
| Guide file paths resolve to existing repo paths | grep + stat | |
| Guide cited commit SHAs exist in git history | git cat-file | |
| Guide claims are accurate | | reviewer |
| `docs-truth` manifest passes | `xtask` | |
| `cargo audit` reports zero vulnerabilities | shell | |
| No WIP or fixup! commits in release range | git log | |
| Working tree is clean | git status | |
| Tag commits to `main` | git branch | |
| CI is green on HEAD at tag time | `gh` API | |
| `BREAKING CHANGE` commits → major/minor version bump | git log | |
| `cargo doc --workspace` builds with zero warnings | cargo doc | |

## Automated Checks — Details

### Issue Tracker (Checks 1, 2, 4)

`cargo xtask release-guard` calls the GitHub CLI to list open issues:

- `lane:asap` — any open issue with this label blocks the release regardless of
  version affinity.
- Version-lane issues — open issues labeled with the release tag (e.g. `v0.1.0`)
  or matching the version string in title or body.
- Prior-version issues — open issues from older version lanes (older
  milestone/label/text matches) that were never closed.

### Version Lockstep (Check 5)

All `Cargo.toml` manifests for published crates must declare the same version
as the release tag. Workspace members are not permitted to drift independently.

### Changelog (Check 6)

`CHANGELOG.md` must contain a section heading of the form
`## [{version}] - YYYY-MM-DD` where `{version}` matches the tag (without the
leading `v`). A section heading without a date is rejected.

### README Headline (Check 8)

`README.md` must contain the string `v{version}` in a `## What's New in`
heading. If the README still refers to a prior release version in that heading,
the check fails.

### TECHNICAL_TEARDOWN (Check 9)

`docs/TECHNICAL_TEARDOWN.md` must contain the string `v{version}` (or
`{version}` without the `v`). This document is updated each release to describe
the current state; a stale reference is a sign the document was not updated.

### Guide File Paths (Check 11)

Backtick-wrapped strings in `docs/guides/` that look like repository-relative
file paths (e.g., `` `crates/wesley-core/src/lib.rs` ``) must resolve to
existing files or directories under the repository root. A guide that cites a
path that was moved or deleted must be updated before release.

### Guide Cited SHAs (Check 12)

Full 40-character commit SHAs appearing in backticks inside `docs/guides/` must
exist in git history (`git cat-file -e <sha>`). A guide citing a commit that
was squashed, force-pushed out, or never existed fails this check.

### docs-truth (Check 14)

The `docs/truth-manifest.json` must be consistent: every entry must point to a
file that exists and whose embedded `docs-truth` metadata comment matches the
manifest fields. All public mkdocs nav pages must appear in the manifest.

### cargo audit (Check 15)

`cargo audit` must report zero known vulnerabilities. Advisories for
dev-dependencies are included. The check is not skippable at release time.

### WIP / fixup! Commits (Check 16)

`git log {prev-tag}..{tag} --format=%s` must not contain any subject lines
starting with `WIP` or `fixup!`. The presence of such commits indicates a
history that was not cleaned up before tagging.

### CI Green (Check 19)

At the time the release-guard runs, the GitHub Actions workflow runs on HEAD
must all have `conclusion=success` (or `skipped`/`neutral` for non-blocking
checks). A pending or failed run blocks the release.

### BREAKING CHANGE → Version Bump (Check 20)

If any commit in the release range contains `BREAKING CHANGE` in its body, the
version must be a major or minor bump from the previous tag. A breaking change
shipped as a patch release is rejected.

### cargo doc (Check 21)

`cargo doc --workspace --no-deps` must compile with zero warnings under
`RUSTDOCFLAGS="-D warnings"`. Public API documentation must not silently rot.

## Human Sign-Off — Details

### CHANGELOG Reflects Actual Diff (Check 7)

A human reviewer must diff the release against the previous tag
(`git log {prev-tag}..{tag} --oneline`) and confirm that the CHANGELOG entry
accounts for all user-visible changes. Machine checks cannot detect a CHANGELOG
entry that is technically present but misleadingly incomplete.

### ARCHITECTURE.md Current (Check 10)

A human reviewer must read `docs/ARCHITECTURE.md` and confirm it accurately
describes the current repository structure, crate relationships, and ownership
boundaries. Stale architecture docs are a silent onboarding hazard.

### Guide Claims Accurate (Check 13)

A human reviewer must spot-check the affected guides from `docs/guides/` to
confirm that commands, file paths, and behavioral claims are accurate against
the current codebase. Automated checks confirm files exist and SHAs resolve;
they cannot confirm that a claimed behavior actually works.

## Policy Violations

If a release is discovered to have shipped in violation of this policy:

1. File a `lane:asap` GitHub Issue immediately documenting the violation.
2. Do not attempt to retroactively fix the published crate — crates.io publishes
   are permanent.
3. If the violation involves a security defect, follow `SECURITY.md`.
4. Issue a corrective patch release at the earliest opportunity.
5. Post-mortem the gate failure and update xtask checks to prevent recurrence.
