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
- Confirm the exact plain `vX.Y.Z` milestone exists; abort if the GitHub query
  cannot resolve it.
- Confirm every scheduled issue, including the release gate, uses that milestone
  and no version label or narrative milestone as a second schedule.
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
- exact target `vX.Y.Z` milestone and its open issue set
- release-gate issue in that milestone

If any discovery item cannot be determined confidently, abort.

## Phase 1: Guards

Run these in order:

1. Verify the working tree is clean.
2. Verify the current branch is `main`.
3. Fetch `origin/main` and tags.
4. Verify `HEAD` exactly matches `origin/main`.
5. Verify tag-signing requirements if the repository requires signed tags.
6. Query the open-milestones API and verify an exact `vX.Y.Z` title match. Do
   not use an empty `gh issue list --milestone` result as existence proof;
   GitHub CLI also returns an empty successful result for a missing milestone.

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

The final `cargo xtask release-prep-guard --version X.Y.Z` is intentionally not
run while the release gate remains open. It is the post-merge, pre-tag tracker
guard in Phase 4.

## Phase 4: Commit, Close Gate, Pre-Tag Checks, Tag, and Publish

1. Review the final diff.
2. Stage the release changes.
3. Create the release commit on a release branch.
4. Land the release commit through the protected `main` branch.
5. Sync local `main` to `origin/main` after the release commit has landed and
   record the exact validated `HEAD` commit.
6. Verify every issue except the gate has been closed, moved to another exact
   version milestone, or explicitly cut.
7. Run a fresh `cargo xtask preflight` from synced `main`; if it fails, leave
   the release gate open and land corrections through a pull request.
8. Complete the human checklist and close the release-gate issue.
9. Run `cargo xtask release-prep-guard --version X.Y.Z`; abort if the exact
   `vX.Y.Z` milestone is missing or still has any open issue.
10. Fetch `origin` again.
11. Abort unless `HEAD` still equals both the recorded validated commit and the
    refreshed `origin/main`.
12. Create the release tag locally on that unchanged, synced `main` commit.
13. Verify the tag points at the release commit and satisfies signing
    requirements where applicable.
14. Run `cargo xtask release-guard --tag vX.Y.Z` after the tag exists locally;
    abort before push on any failure.
15. Push the exact release tag only, for example: `git push origin vX.Y.Z`.
16. Monitor the tag-triggered workflow that creates its draft GitHub Release,
    publishes artifacts, verifies delivery, and finalizes that same release.
    Do not create or finalize a competing release manually.
17. Verify registries directly before claiming publication succeeded.
18. Preserve post-publication evidence in the workflow run, finalized GitHub
    Release, registry records, and direct delivery witness.

## Idempotency And Failure Handling

The public tag is immutable. Do not move it.

If any check or action fails after the gate closes but before the tag is pushed:

1. Do not push again. Resolve the exact remote state with
   `git ls-remote --exit-code --tags origin refs/tags/vX.Y.Z`. Exit zero means
   the tag is already public; exit two with no matching ref means it is proven
   absent. Any authentication, transport, or other result is indeterminate.
2. If the tag is present remotely, do not delete the local tag and do not reopen
   the gate. Stop this recovery and use the immutable public-tag failure path
   below.
3. If remote state is indeterminate, change neither the tag nor the gate. Stop
   until remote state can be resolved conclusively.
4. Only when the tag is proven absent may local recovery continue. If a local
   tag was created, delete only that unpublished tag with `git tag -d vX.Y.Z`;
   if failure occurred before local tag creation, skip deletion.
5. Reopen the release gate, record the failed check, and assign any corrective
   issue to the exact version milestone.
6. Land corrections through the normal pull-request path, then repeat the
   post-merge pre-tag checks before recreating the signed local tag.

An unpublished local tag is recoverable scratch state. A tag that exists on the
remote is a public release fact and must never be deleted, moved, or recreated.

If the tag exists but publication did not complete:

1. Keep the tag fixed.
2. Determine whether the failure is in release inputs or release machinery.
3. Same-tag reruns are allowed only when the tagged source is correct and the
   failure is credentials, permissions, transient registry state, or GitHub
   Release/API delivery.
4. If the workflow source checked into the tag is wrong, do not rerun the
   immutable tag expecting a later workflow fix to apply.
5. If any source, metadata, package, or workflow-input change is required, open
   the next patch milestone and patch forward from `main` under a new version
   and tag.
6. Use explicit maintainer-approved manual recovery only when no source change
   is required, no contradictory public artifact escaped, and the recovery
   still verifies the same tagged source. Manual recovery must never create,
   edit, finalize, or recreate the GitHub Release; the tag workflow exclusively
   owns that lifecycle.
7. Preserve both the failure and the successful rerun or patch-forward release
   in workflow, GitHub Release, and delivery-witness evidence.

If one crate publishes and another fails:

1. Keep the tag fixed.
2. Confirm the already-published crate versions match the tag source.
3. If the tagged inputs are correct and the failure was transient, rerun the
   idempotent workflow so it verifies existing crates and publishes only missing
   artifacts where crates.io allows that path.
4. If a source or package fix is required, do not mutate the tag or reuse an
   already-published version; cut a corrective patch release.

If the GitHub Release fails:

1. Keep the tag fixed.
2. If the tagged inputs and checked-in workflow are correct, rerun the same tag
   workflow so it resumes or recreates its own draft and finalizes that release.
3. If source or checked-in workflow changes are required, patch forward under a
   new version and tag; do not mutate the failed release manually.
4. Verify the workflow-owned release notes match the tag source.

If a published artifact is bad:

1. Do not move the tag.
2. Cut a new patch release from `main`.
3. Deprecate or warn on the bad version only when the registry policy and user
   impact make that the right move.
4. File fallout issues and record the patch-forward decision.

Manual tagging is not an emergency bypass in Wesley. It is the normal mechanism
because the release profile declares `autotag: none`. Create the local tag only
after post-merge pre-tag checks pass from clean, fetched, synced `main`, and push
it only after the tag-specific guard passes.

## Phase 5: Verification, Retrospective, And Closeout

After the tag workflow publishes and public verification passes:

1. Verify the workflow, finalized GitHub Release, crates.io records, and direct
   CLI smoke witness. These are the authoritative post-publication evidence.
2. Do not edit the tagged release packet merely to backfill facts that did not
   exist before publication. Preserve historical release packets as they were
   reviewed and tagged.
3. Record plan-versus-actual scope: shipped, slipped, cut, expanded, and why.
4. Identify repeatable wins and concrete process improvements.
5. File fallout issues with a definition of done and either one future plain
   version milestone or one `triage:*` label with no milestone.
6. Close the now-empty release milestone.
7. Write or refresh the next release thesis before making the next planned
   train active.

## Evidence

Before tagging, record the repo-resident validation witness in
`docs/method/releases/vX.Y.Z/verification.md`. At minimum include:

- discovery facts
- commands run
- pass/fail results
- intended tag and candidate commit SHA
- intended GitHub Release and registry verification paths
- `docs/topics/` accuracy and coverage scores, with links to any corrections
- any non-blocking warnings

After publication, keep the actual workflow URL, finalized GitHub Release,
registry URLs, smoke output, warnings, and patch-forward decisions in the
workflow/GitHub Release/delivery witness. Do not require a post-publication
commit to make the tagged source truthful.
