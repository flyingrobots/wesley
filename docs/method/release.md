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

## Doctrine

A valid Wesley release has all of the following:

1. **A reason**: planned releases have a release thesis before implementation
   scope becomes active.
2. **A bucket**: Wesley uses GitHub for live work state. Implementation issues
   stay in `Goalpost: ...` milestones; release-gate issues stay in
   `Release: vX.Y.Z` milestones; concrete `vX.Y.Z` labels are the version
   scheduling axis because GitHub issues can carry only one milestone.
3. **Honest scope**: must-ship, may-slip, and explicitly-not-included work is
   recorded before release prep.
4. **A reviewed source commit**: the release tag points at the exact `main`
   commit that passed release prep.
5. **An immutable public tag**: signed public tags are not moved. Bad releases
   are fixed by patching forward.
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
11. **Evidence**: tag, commit, workflow, artifact, verification, and
    retrospective evidence remain inspectable.
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

A release is planned when a `Release: vX.Y.Z` milestone exists, a release-gate
issue exists, the release thesis exists, must-ship/may-slip/not-included scope
is recorded, two to five goalposts are named, and acceptance evidence is clear.

### active

A release is active when it is the current version train, at least one selected
goalpost issue is in progress, priority labels reflect the real queue, and
exactly one active slice or tracking issue is marked as active for the train.

### release-prep

A release enters prep when implementation scope is reconciled against the
previous public tag, slipped work is moved or cut, version metadata is updated,
release signposts are updated, local release-prep validation passes, and a
`release/vX.Y.Z` branch exists.

### merged

A release is merged when the release-prep PR has approval or explicit maintainer
admin authorization, CI is green, release-prep validation has passed, and the
release branch has landed on `main`. The merge commit is the candidate release
commit.

### tagged

A release is tagged when final preflight passes from synced `main`, the expected
tag does not already exist, and an annotated signed tag is created at the exact
candidate release commit.

```bash
git tag -s vX.Y.Z -m "release: vX.Y.Z"
```

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
  thesis, scoped issues, goalposts, release-prep PR, full validation,
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
  Internal release witness. It records discovery, pre-flight validation,
  tag/publish evidence, and direct verification of delivery.
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

## Goalposts And Evidence

A planned release should have two to five goalposts. Each goalpost names an
outcome, issue set, and observable acceptance evidence. Good evidence includes
command output, test results, workflow runs, registry lookups, documentation
links, smoke tests, closed issues, and merged PRs.

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
3. Accept the release thesis, scope, goalposts, and version justification.
4. Draft the user-facing release notes in `docs/releases/vX.Y.Z.md`.
5. Reconcile scope against the previous public tag.
6. Run the sequential pre-flight in `docs/method/release-runbook.md`.
7. Land the release-prep PR on `main`.
8. Create the signed tag on synced `main`.
9. Publish from the tag.
10. Verify delivery directly.
11. Record the release witness and retrospective.
12. Close the release and plan the next thesis.

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
