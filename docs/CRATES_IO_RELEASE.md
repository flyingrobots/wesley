# CRATES.IO RELEASE

<!-- docs-truth: status=experimental owner=@flyingrobots -->

This is Wesley's official Rust release procedure.

The distribution target is crates.io. The release authority is GitHub Actions.
Humans prepare commits and tags; GitHub Actions performs the publish.

## Non-Negotiable Policy

1. Releases must only be performed by GitHub Actions.
2. Releases must only be performed from a versioned `v*` tag whose commit is
   reachable from `origin/main`.
3. The publish job must only run after the full release gauntlet succeeds.
4. The publish job must perform its own sanity checks before uploading crates.
5. A local `cargo publish` is never an official Wesley release.
6. `cargo xtask publish-crates --execute` is blocked unless it is running in a
   GitHub Actions tag workflow whose ref matches the requested release tag.
7. The legacy `cargo xtask publish-alpha` command remains a dry-run planning
   helper for the first alpha package set; it is not the project release path.

A valid release tag looks like one of these:

```text
v0.1.0
v0.1.0-alpha
v0.1.0-alpha.1
v0.1.0-beta.1
v0.1.0-rc.1
```

The Rust package versions must match the tag after stripping the leading `v`.
For example, tag `v0.1.0-alpha.1` requires every published Wesley crate to have
`version = "0.1.0-alpha.1"`.

## Published Units

| Crate                    | Publishes      | Purpose                                                                                              |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `wesley-core`            | library        | GraphQL lowering, schema hashing, schema diffing, operation analysis, and directive data extraction. |
| `wesley-emit-rust`       | library        | Rust model and operation-binding projection from Wesley IR.                                          |
| `wesley-emit-typescript` | library        | TypeScript declaration and operation-binding projection from Wesley IR.                              |
| `wesley-cli`             | binary package | Installs the `wesley` command.                                                                       |

The bare `wesley` crate name is already occupied on crates.io, so the
installable package is `wesley-cli`:

```bash
cargo install wesley-cli --version X.Y.Z
wesley --help
```

## GitHub Actions Release Shape

The release workflow is tag-triggered:

```text
push tag v*
  -> release-gauntlet
  -> publish-crates
```

The `release-gauntlet` job must verify:

- checkout has full history and tags
- tag resolves to the workflow `HEAD`
- tag commit is reachable from `origin/main`
- every published `Cargo.toml` version matches the tag
- every internal Wesley dependency version matches the tag
- every publishable crate has the minimum package file set
- root `README.md` exists
- root `CHANGELOG.md` contains release notes for the exact version
- no open GitHub Issue is associated with the exact tag or version by issue
  title/body text, milestone, or label
- Rust check, test, clippy, docs, release-check, package sanity, and audit pass

The `publish-crates` job must depend on `release-gauntlet` and must repeat the
release guard before uploading. It extracts release notes and creates a draft
GitHub Release before the first crates.io mutation. It then publishes in
dependency order, performs a `cargo publish --dry-run` immediately before each
real `cargo publish`, verifies crates.io visibility, and only then finalizes the
GitHub Release.

## Release Pre-Flight Contract

This contract is intentionally strict. A release engineer or release workflow
must stop immediately at the first hard failure.

### Universal Rules

1. Execute phases in order. Do not skip, reorder, merge, or parallelize phases.
2. `ABORT` means stop immediately. Do not continue past an `ABORT` condition.
3. Never guess. Never claim success for anything not directly verified.
4. Never fabricate evidence. On failure, report command, exit code, and output.
5. If required tools, credentials, signing keys, CI visibility, or registry
   visibility are missing, `ABORT`.
6. Before every mutating action, state what will change. After every mutating
   action, report what changed.
7. Detect and use repo-native tooling.
8. Use UTC dates in `YYYY-MM-DD` format.
9. Respect shared workspace version fields. Do not duplicate version
   declarations if the repo centralizes versioning.
10. Do not claim publication, provenance, OIDC, trusted publishing, CI success,
    or registry visibility unless directly verified.

### Initial Discovery

Before mutating anything, determine and report:

- repository type
- package managers
- workspace and root manifests
- version-bearing manifests that must be updated
- publishable units
- latest reachable semver tag matching `v*`
- current branch
- exact sync state versus `origin/main`

`ABORT` if any item cannot be determined confidently.

`ABORT` if no reachable semver tag exists and no explicit initial-release
policy has been provided.

### Phase 1: Environment And Repo Guards

1. Run `git status --porcelain=v1`.
2. `ABORT` if the working tree is not clean.
3. Run `git rev-parse --abbrev-ref HEAD`.
4. `ABORT` if the branch is not `main` for release preparation.
5. Run `git fetch origin main --tags --prune`.
6. Verify `HEAD` equals `origin/main`.
7. `ABORT` if local `main` is ahead of or behind `origin/main`.
8. Verify signed-tag readiness for human-created release tags.
9. `ABORT` if signing is unavailable or misconfigured.

### Phase 2: Versioning And Lock-Step Sync

1. Identify the latest reachable semver tag matching `v*`.
2. Determine the SemVer bump from commits since the last tag.
3. Use this precedence: breaking changes are major, `feat:` is minor, `fix:`,
   `perf:`, `docs:`, and user-visible maintenance are patch.
4. `ABORT` if no releasable changes exist.
5. Determine stable versus prerelease.
6. Compute the target version.
7. Verify that the exact target tag does not exist locally or remotely.
8. `ABORT` on tag collision.
9. Update every in-scope version-bearing manifest to the exact same version.
10. Refresh lockfiles using the least-invasive repo-native command.
11. `ABORT` if lockfile changes include unrelated churn.
12. Scan publishable units for `file:`, `link:`, `workspace:`, local path, and
    direct git URL dependencies.
13. `ABORT` if any publishable artifact contains registry-incompatible
    dependencies after dry-run validation.

For Wesley Rust crates, local `path` dependencies are allowed only for sibling
Wesley crates when paired with an exact matching `version`.

### Phase 3: Documentation

1. Locate `[Unreleased]` in `CHANGELOG.md`.
2. `ABORT` if `[Unreleased]` is missing or empty.
3. Rename it to `[X.Y.Z] - YYYY-MM-DD` using the target version and UTC date.
4. Preserve the existing changelog style, anchors, and compare links.
5. Find or create `## What's New in vX.Y.Z` in `README.md`.
6. Write a concise user-facing summary.
7. Ensure `README.md` visibly links to `CHANGELOG.md`.
8. Extract the final changelog section for GitHub Release notes.

### Phase 4: The Gauntlet

`ABORT` immediately if any applicable validation fails.

The Rust gauntlet for Wesley is:

```bash
cargo xtask docs-check
cargo check --workspace --all-targets
cargo test --workspace --all-features
cargo clippy --workspace --all-targets -- -D warnings
cargo xtask release-check
cargo audit
cargo xtask release-prep-guard --version X.Y.Z
cargo xtask package-crates --version X.Y.Z
```

The release workflow also checks open GitHub issues for the exact tag and
version using issue title/body text, milestone association, and label
association. Third-party comments and automatic cross-reference chatter are not
release-lane ownership. Any matching open issue blocks publication.

For a multi-crate release where later crates depend on earlier Wesley crates,
the full registry-backed `cargo publish --dry-run` for dependent crates cannot
complete until the upstream Wesley crate version is visible in the crates.io
index. The publish job therefore dry-runs each crate immediately before its
real upload, after any internal dependencies have been published and observed in
the index. The planning command `cargo xtask publish-crates --tag vX.Y.Z`
reports this explicitly as an incomplete dry-run instead of treating skipped
crates as a passed gauntlet.

Packaging sanity must fail on:

- missing expected files
- unexpected package contents
- incorrect version numbers
- unresolved workspace references
- registry-incompatible dependencies

### Phase 5: Commit And Tagging

1. Summarize the final diff.
2. Stage all release-prep changes.
3. Create exactly one release commit:

```bash
git commit -m "chore(release): vX.Y.Z"
```

For prereleases:

```bash
git commit -m "chore(release): vX.Y.Z-alpha.1"
```

4. Create exactly one signed tag:

```bash
git tag -s vX.Y.Z -m "release: vX.Y.Z"
```

For prereleases:

```bash
git tag -s vX.Y.Z-alpha.1 -m "release: vX.Y.Z-alpha.1"
```

5. Verify the tag points at the release commit.
6. Verify the tag signature.
7. `ABORT` if verification fails.

### Phase 6: Delivery, Release, And Monitoring

1. Push `main`.
2. Push the exact release tag.
3. Let GitHub Actions run the tag-triggered release workflow.
4. Create or verify the GitHub Release from the versioned changelog notes.
5. Monitor every workflow triggered by the release commit and tag.
6. Do not infer success from queued or in-progress jobs.
7. Verify crates.io directly for every published crate.

`ABORT LOUDLY` if any of these fail:

- tag guard
- trusted publishing or registry credential handshake
- crates.io publication
- GitHub Release creation
- registry visibility

## Official Commands

Preparation and validation:

```bash
cargo xtask docs-check
cargo check --workspace --all-targets
cargo test --workspace --all-features
cargo clippy --workspace --all-targets -- -D warnings
cargo xtask release-check
cargo xtask release-prep-guard --version X.Y.Z
cargo xtask package-crates --version X.Y.Z
```

After creating the signed tag, verify the tag-specific guard:

```bash
cargo xtask release-guard --tag vX.Y.Z
```

Dry-run package plan:

```bash
cargo xtask publish-crates --tag vX.Y.Z
```

This command is intentionally strict for official releases: if an internal
dependency has not reached crates.io yet, skipped dependent dry-runs are
reported as failures rather than success.

Publish command used by GitHub Actions only:

```bash
cargo xtask publish-crates --tag vX.Y.Z --execute --skip-checks
```

The publish command still performs a clean-worktree check, manifest version
check, and per-crate dry-run before each upload. `--skip-checks` skips the long
gauntlet only because the publish job is downstream of the gauntlet job.

## Failure Report Shape

On `ABORT`, report exactly:

1. `Result`: `ABORTED`
2. `Phase`: failing phase
3. `Step`: failing step
4. `Command`: exact command
5. `Exit Code`: numeric exit code if available
6. `Evidence`: concise stdout/stderr excerpt
7. `Cause`: plain-English root cause
8. `Required Human Action`: minimum fix before rerun

On success, report:

1. `Result`: `SUCCESS`
2. `Version`: final version string
3. `Release Type`: stable or prerelease
4. `Updated Units`: crates released
5. `Commit`: release commit SHA
6. `Tag`: release tag and tagged commit SHA
7. `Changed Files`: concise list
8. `Validation Summary`: commands run plus pass/fail
9. `Published Artifacts`: crates and registry destination
10. `GitHub Release`: URL
11. `Registry URLs`: crates.io URLs
12. `Warnings`: non-blocking concerns
