# Release Runbook

<!-- docs-truth: status=current owner=@flyingrobots -->

Use this runbook when a release has already been shaped in
`docs/method/releases/vX.Y.Z/release.md` and is ready for pre-flight.

This is intentionally the execution layer, not the doctrine layer. The release
doctrine lives in `docs/method/release.md`.

The repo-local release profile lives in [`.continuum/release.yml`](../../.continuum/release.yml).
Use it as the source for version sources, publish crates, signposts, workflow
names, and verification commands.

## Abort Conditions

- Never guess. Never claim success for anything you did not directly verify.
- Never fabricate evidence. Record the exact command, exit code, and relevant
  output on failure.
- Ensure the working tree is clean; abort if dirty.
- Confirm `main` is exactly synced with `origin/main`; abort if not.
- Verify required tools, credentials, signing configuration, CI visibility, and
  registry visibility are available; abort if missing.
- Ensure every required validation and publish verification step succeeds;
  abort if any fail.

## Phase 0: Discovery

Before changing anything, determine and record:

- repository type: JavaScript/TypeScript, mixed workspace, or other
- package manager and lockfile authority
- all version-bearing manifests
- all publishable units
- release profile presence and obvious agreement with the current repo
- latest reachable semver tag matching `v*`
- current branch
- exact sync state versus `origin/main`

If any discovery item cannot be determined confidently, abort.

## Phase 1: Guards

Run these in order:

1. Verify the working tree is clean.
2. Verify the current branch is `main`.
3. Fetch `origin/main` and tags.
4. Verify `HEAD` exactly matches `origin/main`.
5. Verify tag-signing requirements if the repository requires signed tags.

Do not continue past the first failed guard.

## Phase 2: Versioning and Release Notes

1. Confirm the target version declared in
   `docs/method/releases/vX.Y.Z/release.md`.
2. Validate that the declared version matches the actual release scope, SemVer
   impact, and repository policy.
3. Verify that the target tag does not already exist locally or on the remote.
4. Update all in-scope version-bearing manifests in lock-step.
5. Refresh lockfiles using the repo-native package manager.
6. Update `CHANGELOG.md`.
7. Write or refresh `docs/releases/vX.Y.Z.md`.

`README.md` may link to durable release surfaces, but it should not become a
per-version release log by default.

## Phase 3: Validation

Run validation strictly in order, using repo-native commands where available:

- audit every tracked file under `docs/topics/` for release-relevant accuracy
  and coverage
- release pre-flight script, if the repo already has one
- `cargo xtask release-prep-guard --version X.Y.Z`, before the tag exists
- `cargo xtask preflight`
- `cargo xtask release-check`
- `cargo xtask package-crates --version X.Y.Z`, before the tag exists
- `cargo xtask legacy-preflight`, only when the release changes legacy
  packages, pnpm workspace files, or compatibility-only package metadata
- build
- lint, if present
- typecheck, if present
- full test suite
- crates.io packaging or publish dry-runs for each publishable Rust crate
- dependency audit
- registry-compatibility checks for dependencies and package metadata

The Rust crates are the release authority for the native Wesley product. Do not
use npm package publication as proof that a Wesley compiler release is ready;
legacy packages are marked private while they remain in the retirement ledger.

The `docs/topics/` audit is a release documentation gate, not a backlog
exercise. Score it before continuing:

- **Accuracy**: at least 90% of audited topic claims must match the current
  codebase, GitHub workflow, issue-triage model, and release policy.
- **Coverage**: at least 90% of release-relevant contributor/operator topic
  workflows must be covered by an existing `docs/topics/` page or by a clear
  link from `docs/topics/` to the authoritative current document.

If either score is below 90%, act before continuing: update stale topic claims,
remove obsolete instructions, add missing topic coverage, or link to the
authoritative current surface. Abort only when the release cannot honestly
reach the 90% accuracy and 90% coverage floors before tagging.

Abort on the first hard failure. Do not claim success from queued or in-progress
CI state.

## Phase 4: Commit, Tag, and Publish

1. Review the final diff.
2. Stage the release changes.
3. Create the release commit on a release branch.
4. Land the release commit through the protected `main` branch.
5. Sync local main to origin/main after the release commit has landed.
6. Create the release tag on the synced `main` commit.
7. Verify the tag points at the release commit and satisfies signing
   requirements where applicable.
8. Run `cargo xtask release-guard --tag vX.Y.Z` after the tag exists locally.
9. Push the exact release tag only, for example: `git push origin vX.Y.Z`.
10. Create the GitHub Release or equivalent forge release using the versioned
    release notes.
11. Monitor triggered workflows to completion.
12. Verify registries directly before claiming publication succeeded.
13. Record release evidence and retrospective before starting the next planned
    release train.

## Idempotency And Failure Handling

The public tag is immutable. Do not move it.

If the tag exists but publication did not complete:

1. Keep the tag fixed.
2. Fix the workflow, credential, registry, or environment problem.
3. Rerun publication for the same tag.
4. Record both the failure and the successful rerun in release evidence.

If one crate publishes and another fails:

1. Keep the tag fixed.
2. Confirm the already-published crate versions match the tag source.
3. Fix the failing crate path.
4. Rerun the workflow so it verifies existing crates and publishes only missing
   artifacts where crates.io allows that path.

If the GitHub Release fails:

1. Keep the tag fixed.
2. Recreate or update the GitHub Release for the same tag.
3. Verify the release notes match the tag source.

If a published artifact is bad:

1. Do not move the tag.
2. Cut a new patch release from `main`.
3. Deprecate or warn on the bad version only when the registry policy and user
   impact make that the right move.
4. File fallout issues and record the patch-forward decision.

Manual tagging is not an emergency bypass in Wesley. It is the normal mechanism
because the release profile declares `autotag: none`. It still must happen only
after final guards pass from clean, fetched, synced `main`.

## Phase 5: Retrospective And Closeout

After the tag workflow publishes and public verification passes:

1. Update `docs/method/releases/vX.Y.Z/verification.md` with tag, commit,
   workflow, GitHub Release, registry, smoke, and warning evidence.
2. Record plan-versus-actual scope: shipped, slipped, cut, expanded, and why.
3. Identify repeatable wins and concrete process improvements.
4. File fallout issues with a definition of done and exactly one scheduling
   state label.
5. Close or move every scoped issue.
6. Close the release milestone after release-gate work is complete.
7. Write or refresh the next release thesis before making the next planned
   train active.

## Evidence

Record the release witness in `docs/method/releases/vX.Y.Z/verification.md`. At
minimum include:

- discovery facts
- commands run
- pass/fail results
- tag and commit SHAs
- GitHub Release URL
- registry URLs
- `docs/topics/` accuracy and coverage scores, with links to any corrections
- any non-blocking warnings
- retrospective summary and fallout issue links
