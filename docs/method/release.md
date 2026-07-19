# Release

<!-- docs-truth: status=current owner=@flyingrobots -->

Releases happen when externally meaningful behavior changes.

Wesley follows the Continuum release spine, adapted for this repository's
actual shape: a domain-free Rust compiler/toolchain that publishes crates from
signed tags on synced `main`. A release is not a version bump. A release is a
promise made visible.

The repo-local mechanics live in [`.continuum/release.yml`](../../.continuum/release.yml).
This doctrine defines the standard; the profile defines the boring facts that
automation and reviewers should enforce.

## Wesley Adaptation

Wesley uses the Continuum spine, but the generic template must be adapted in
these important ways:

| Generic lifecycle point | Wesley adaptation                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version bucket          | One exact plain `vX.Y.Z` milestone is the sole schedule for implementation work and its release gate.                                               |
| Release gate            | The gate shares the version milestone, is its final open issue, and closes before the signed local tag is created.                                  |
| Grouping and priority   | GitHub Project fields and classification labels may group or prioritize work, but they never schedule a release.                                    |
| Autotag                 | `.continuum/release.yml` declares `autotag: none`. Maintainers tag locally after pre-tag checks, then run the tag-specific guard before push.       |
| Package/channel policy  | crates.io is the public package registry. npm, JSR, and dist-tag policy do not apply to the current Wesley release surface.                         |
| Publication             | `.github/workflows/release-crates.yml` runs from the tag and must verify tag, metadata, main reachability, package visibility, and GitHub Release.  |
| Public release boundary | The tag points at the exact reviewed `main` commit. A bad public release is corrected by a later patch; its tag and published artifacts never move. |
| Domain boundary         | Release scope must not add downstream domain semantics to Wesley core. Extensions and sibling repos own meaning.                                    |

The root [release process](../../RELEASE.md) is a thin maintainer entrance. This
page remains the doctrine. The command-by-command execution layer remains
[`docs/method/release-runbook.md`](release-runbook.md).

## Doctrine

A valid Wesley release has all of the following:

1. **A reason**: planned releases have a release thesis before implementation
   scope becomes active.
2. **One schedule**: Wesley uses one exact plain `vX.Y.Z` GitHub milestone for
   every scheduled issue, including the release gate. An unscheduled issue has
   exactly one `triage:*` label and no milestone. Project fields, grouping
   labels, issue titles, and body text may explain work, but they do not
   schedule it. Release guards query only the exact version milestone and fail
   if it is missing.
   Here `vX.Y.Z` means exact tag-form SemVer. Every prerelease uses its full
   milestone title, such as `v0.3.0-alpha.2`.
3. **Honest scope**: must-ship, may-slip, and explicitly-not-included work is
   recorded before release prep.
4. **A reviewed source commit**: the release tag points at the exact `main`
   commit that passed release prep.
5. **An immutable public tag**: the release gate closes before tagging. Signed
   public tags are never moved, and bad releases are fixed by patching forward.
6. **Synchronized metadata**: every version source declared in the release
   profile agrees.
7. **Updated signposts**: changelog, README, guide, architecture, topics,
   release notes, operator docs, and maintainer docs change when their truth
   changes.
8. **Executable gates**: release law lives in `cargo xtask` checks and GitHub
   Actions, not only in prose.
9. **Publication from the tag**: crates, GitHub Release notes, and registry
   evidence are produced from the tagged source.
10. **Post-publication verification**: a release is done when consumers can see
    and use the crates, not when the upload command returns.
11. **Evidence**: the tagged commit carries all repo-resident truth available
    before publication. The tag workflow, GitHub Release, registry, and direct
    delivery witness retain post-publication evidence without a backfill merge.
12. **Learning**: planned releases end with a retrospective and fallout issues.

## Lifecycle

Wesley releases move through this lifecycle:

```text
planned
  -> active
  -> release-prep
  -> merged
  -> tagged
  -> published
  -> verified
  -> retrospected
  -> closed
```

### planned

A release is planned when the exact plain `vX.Y.Z` milestone exists, its
release-gate issue exists in that milestone, the release thesis exists,
must-ship/may-slip/not-included scope is recorded, two to five release outcomes
are named, and acceptance evidence is clear.

### active

A release is active when it is the current version train, at least one issue in
its version milestone is in progress, Project priority and workflow fields
reflect the real queue, and exactly one active slice or tracking issue is marked
as active for the train.

### release-prep

A release enters prep when implementation scope is reconciled against the
previous public tag, slipped work is moved or cut, version metadata is updated,
release signposts are updated, local release-prep validation passes, and a
`release/vX.Y.Z` branch exists. The gate remains open while other milestone
work remains and becomes the final pre-tag issue.

### merged

A release is merged when the release-prep PR has approval or explicit maintainer
admin authorization, CI is green, release-prep validation has passed, and the
release branch has landed on `main`. The merge commit is the candidate release
commit. At this point every other issue in the version milestone must already
be closed, moved to another exact version milestone, or cut.

### tagged

A release is tagged locally only after a fresh `cargo xtask preflight` passes
from synced `main` while the gate remains open, the gate then closes, the
post-merge `release-prep-guard` confirms the exact version milestone has zero
open issues, the validated commit still equals refreshed `origin/main`, the
expected tag does not already exist, and an annotated signed tag is created at
that exact candidate release commit. The tag-specific `release-guard` then must
pass against that local tag before it is pushed.

```bash
git tag -s vX.Y.Z -m "release: vX.Y.Z"
```

The public immutability boundary is the tag push. After a post-gate failure,
follow the runbook to resolve remote tag state. Reopen the gate and delete a
local tag only when that tag is proven absent from the remote; mutate neither
when it is present or indeterminate.

### published

A release is published when `.github/workflows/release-crates.yml` checks out
the tag, verifies tag/metadata/main reachability, builds artifacts from the tag,
publishes every configured crate, and creates/finalizes the GitHub Release.

### verified

A release is verified when public crates.io visibility is confirmed for every
published crate, the installed `wesley` CLI launches, the GitHub Release is
visible, and release evidence is captured.

### retrospected

A release is retrospected when released work, unreleased work,
plan-versus-actual scope, repeatable wins, concrete improvements, fallout
issues, and the next release recommendation are recorded.

### closed

A release is closed when scoped work is closed, moved, or explicitly cut;
fallout issues are triaged; the release milestone is closed; the next thesis
exists; and the next active slice is selected.

## Release Types

- **Planned release**: normal minor, major, and meaningful patch trains. Requires
  thesis, scoped issues, release outcomes, release-prep PR, full validation,
  publication evidence, and retrospective.
- **Patch release**: compatible bug fixes, packaging fixes, docs corrections
  tied to current behavior, and narrow operator workflow improvements. Requires
  a short patch thesis, changelog entry, validation, publication evidence, and a
  lightweight retrospective.
- **Emergency or security release**: urgent production, security, data-loss,
  broken package, or severe operator-impacting fixes. Planning may be
  abbreviated, but immutable tags, proportional validation, verification,
  retrospective, and fallout issues remain mandatory.
- **Prerelease**: alpha, beta, preview, or release-candidate crates. Prereleases
  must not be treated as stable signposts unless promoted through a release
  decision.
- **Docs-only release**: allowed only when the public release surface includes
  docs or release notes consumers rely on. Runtime behavior changes must be
  explicitly marked as absent.

## Version Selection

Wesley uses SemVer.

- **Patch**: compatible fixes, dependency updates without public behavior
  change, documentation corrections that describe existing behavior, and narrow
  release-tooling fixes.
- **Minor**: new compatible CLI commands, public workflows, emitter behavior,
  configuration options, or additive APIs.
- **Major**: incompatible CLI flag/default/output changes, public API removal,
  package entrypoint changes, storage/IR schema changes consumers must handle,
  or support-boundary removals.
- **Prerelease**: early artifacts without stable guarantees.

## Shaped Release

A shaped release is a deliberate packet that says what is shipping, why this
version number is correct, which users benefit, and what they need to do next.

Required release artifacts:

- `docs/method/releases/vX.Y.Z/release.md`
  Internal release design and acceptance packet. It defines:
  - included shipped cycles or externally meaningful changes
  - hills advanced by the release
  - sponsored users affected and how they are helped
  - why this exact version number is justified
  - whether migration guidance is required
- `docs/method/releases/vX.Y.Z/verification.md`
  Internal pre-tag release witness. It records discovery, pre-flight validation,
  the intended tag/publish path, and the direct verification plan. Actual
  post-publication facts remain in the workflow run, finalized GitHub Release,
  registry records, and direct delivery witness rather than a backfill commit.
- `docs/releases/vX.Y.Z.md`
  User-facing release notes and migration guide.
- `CHANGELOG.md`
  Historical ledger of externally meaningful behavior.

`CHANGELOG.md` remains the ledger. The user-facing guided release surface lives
in `docs/releases/`.

## Scope Model

Every planned release records three scope buckets:

- **Must-ship**: work that defines the release.
- **May-slip**: valuable work that may move without invalidating the thesis.
- **Explicitly not included**: work people might assume is included but is not.

The release design names and justifies the intended version before tagging.
Commit history, diff inspection, and validation can support or challenge that
judgment during pre-flight, but they do not silently own the decision by
themselves.

## Release Outcomes And Evidence

A planned release should have two to five named release outcomes. Each outcome
names an issue set and observable acceptance evidence without creating a second
scheduling axis. Good evidence includes command output, test results, workflow
runs, registry lookups, documentation links, smoke tests, closed issues, and
merged PRs.

## Signposts

Update every signpost whose truth changed since the previous public tag:

- `CHANGELOG.md`
- `README.md`
- `docs/README.md`
- `docs/GUIDE.md`
- `docs/ENTRYPOINTS.md`
- `docs/ARCHITECTURE.md`
- `docs/TECHNICAL_TEARDOWN.md`
- `docs/site/`
- `docs/topics/`
- `docs/reference/`
- `docs/releases/vX.Y.Z.md`
- `docs/method/releases/vX.Y.Z/`
- `docs/method/release.md`
- `docs/method/release-runbook.md`
- `docs/CRATES_IO_RELEASE.md`
- `docs/governance/RELEASE_POLICY.md`
- `docs/governance/RELEASE_CHECKLIST.md`
- `docs/METHOD.md`, `CONTRIBUTING.md`, and `AGENTS.md` when process truth
  changes

The `docs/topics/` audit is mandatory before tagging. It must reach at least
90% accuracy and 90% coverage for release-relevant contributor and operator
workflows.

## Defaults

- Not every cycle is a release.
- Every cycle still updates the living docs honestly.
- Every release still needs a user-facing explanation, not just a ledger entry.
- `README.md` should point at durable release surfaces, not accumulate
  per-version sediment.

## Sequence

1. Shape the release in `docs/method/releases/vX.Y.Z/release.md`.
2. Confirm the release profile still matches the repo.
3. Accept the release thesis, scope, release outcomes, and version justification.
4. Draft the user-facing release notes in `docs/releases/vX.Y.Z.md`.
5. Reconcile scope against the previous public tag.
6. Run the sequential pre-flight in `docs/method/release-runbook.md`.
7. Land the release-prep PR on `main`.
8. Confirm the release gate is the milestone's only remaining open issue, then
   repeat fresh preflight from synced `main` while the gate remains open.
9. Close the gate, run the final exact-milestone guard, reverify the unchanged
   synced commit, create the signed local tag, and run the tag-specific guard.
10. Push the exact tag and let its workflow publish.
11. Verify delivery directly from workflow, GitHub Release, registry, and smoke
    evidence.
12. Record the retrospective and plan the next thesis without rewriting the
    published release.

## Templates

Use these shapes for planned releases and heavier patch releases.

### Release Gate Issue

The gate uses the exact release version in its title and belongs to the matching
plain `vX.Y.Z` milestone. It is the final pre-tag issue, not a post-publication
evidence bucket. Close the gate issue before creating the signed local tag.

```markdown
# Release gate: vX.Y.Z

## Thesis

This release advances `<capability boundary>` for `<primary user/operator>` by
`<main outcome>`. It focuses on `<included scope>` and deliberately excludes
`<not-included scope>`, which remains in `<future version/research>`.

## Release type

planned | patch | emergency | security | prerelease | docs-only

## Scope

### Must-ship

- ...

### May-slip

- ...

### Explicitly not included

- ...

## Release outcomes

### 1. <name>

Outcome:
Evidence:
Issues:

## Release prep

- [ ] Scope reconciled
- [ ] Every scheduled issue shares milestone `vX.Y.Z`
- [ ] Every other milestone issue is closed, moved, or cut
- [ ] Version metadata updated
- [ ] Changelog updated
- [ ] Signposts updated
- [ ] Release prep validation passed
- [ ] Release-prep PR merged to main
- [ ] Fresh preflight passed from synced main while this gate remained open
- [ ] Human release checklist complete
- [ ] Close this gate before running the exact-milestone tracker-clear guard
- [ ] Create the signed local tag only from the unchanged validated commit
- [ ] Run the tag-specific guard before pushing the tag

## Planned publication

- Signed tag: `vX.Y.Z` from synced `main`
- Workflow: Release Crates
- GitHub Release: created/finalized by the tag workflow
- Registry verification: direct crates.io lookup and CLI smoke

## Pre-tag evidence

Commit:
Release PR:
Validation:
Release packet:
Verification plan:
```

### Release-Prep PR Body

```markdown
# release: vX.Y.Z

## Linked issue

Tracks #<release-gate>

Use a non-closing reference for the gate. The release-prep PR must not use
`Closes`, `Fixes`, or `Resolves` for it; the gate closes only after this PR
lands and final human sign-off completes.

## Summary

Prepare vX.Y.Z for release.

## Release type

planned | patch | emergency | security | prerelease | docs-only

## Thesis

...

## Previous public tag

vPREVIOUS

## Target tag

vX.Y.Z

## Scope reconciliation

### Shipped

- ...

### Slipped

- ...

### Explicitly not included

- ...

## Version metadata

- [ ] Cargo manifests updated
- [ ] `package.json` updated
- [ ] Lockfiles updated, if applicable

## Release signposts

- [ ] CHANGELOG.md
- [ ] README/front door
- [ ] Architecture docs
- [ ] User docs
- [ ] Operator docs
- [ ] Contributor/maintainer docs
- [ ] Migration/security docs, if applicable

## Validation

- [ ] `cargo xtask preflight`
- [ ] `cargo xtask release-check`
- [ ] `cargo xtask package-crates --version X.Y.Z`
- [ ] docs/topics accuracy and coverage audit
- [ ] CI green

The final `release-prep-guard` runs only after this PR lands and the release
gate closes; it cannot pass while that gate remains open.

## Publish notes

Manual publish required: no. Push signed tag `vX.Y.Z`; tag workflow publishes
crates and the GitHub Release.
```

## User-Facing Release Notes

These notes should be documentation, not ledger sludge. At minimum they should
answer:

- Summary
- What Changed
- Why It Matters
- Breaking Changes
- Migration
- Links to deeper docs

If no migration is required, say `No migration required.` explicitly.

## Runbook

The doctrine lives here. The command-by-command, abort-fast release procedure
lives in `docs/method/release-runbook.md` so it can become more explicit or
automated later without bloating the core doctrine.

## Non-Negotiables

```text
No planned release without a thesis.
No release-prep PR without scope reconciliation.
No tag that does not point at the reviewed synced main commit.
No moving public tags.
No publishing from untagged moving source.
No silent version/profile mismatch.
No release without post-publication verification.
No planned release train after publication without a retrospective.
No domain-specific behavior in Wesley core release scope.
```
