# Release Checklist

<!-- docs-truth: status=current owner=@flyingrobots -->

This is the human sign-off template for Wesley releases. Copy this checklist
into the release PR body and complete it before creating the release tag.

Automated checks are not listed here — those run inside
`cargo xtask release-guard --tag vX.Y.Z` and block CI automatically. Before
the release-prep PR, run `cargo xtask release-check` locally; it runs the same
strict preflight gate used by `release-guard`, then builds and packages the
native release artifacts without publishing anything. After the PR lands and
while the gate remains open, repeat `cargo xtask preflight`; close the gate only
after it passes, then run the post-merge `release-prep-guard`, create the signed
tag locally, and require the tag-specific `release-guard` to pass before push.
A post-gate failure reopens the gate only after the target tag is proven absent
from the remote. This checklist covers checks 7, 10, 13, 18, 22, 23, and 24 from
the enforcement matrix, which require human judgment.

The exact plain `vX.Y.Z` milestone is the sole release schedule. Every release
issue, including the gate, belongs to it. Complete this review after every other
milestone issue is closed or moved; then close the gate before creating the
signed local tag.

See [`RELEASE_POLICY.md`](RELEASE_POLICY.md) for the full enforcement matrix
and rationale.

---

## Pre-Tag Sign-Off for `v_____`

**Reviewer:** @
**Date:**

### Human-Review Items

- [ ] **CHANGELOG reflects actual diff**
      I ran `git log <prev-tag>..<this-tag> --oneline` and confirmed that the
      `CHANGELOG.md` entry for this release accounts for all user-visible changes.
      No significant change is silently absent from the entry.

- [ ] **`docs/ARCHITECTURE.md` is current**
      I read `docs/ARCHITECTURE.md` and confirmed it accurately describes the
      current repository structure, crate relationships, and ownership boundaries.
      No crate, package, or boundary described has been removed, renamed, or
      fundamentally changed without the doc being updated.

- [ ] **Guide claims are accurate**
      I spot-checked the guides in `docs/guides/` that are relevant to changes in
      this release. Commands, flags, file paths, and behavioral claims match the
      current codebase. I did not rely solely on the automated path/SHA checks.

- [ ] **`docs/topics/` accuracy and coverage gate is met**
      I audited every tracked file under `docs/topics/` for release-relevant
      accuracy and coverage. At least 90% accuracy of audited topic claims and
      at least 90% coverage of release-relevant contributor/operator topic
      workflows are met. Any stale topic claim, obsolete instruction, missing
      topic, or missing authoritative link was corrected before tagging.

- [ ] **Release thesis and scope are honest**
      I confirmed the release packet records the thesis, must-ship work,
      may-slip work, explicitly-not-included work, selected release outcomes, acceptance
      evidence, and retrospective/evidence location. Any planned work that did
      not ship was moved, cut, or acknowledged before tagging.

- [ ] **The exact version milestone is the complete schedule**
      I confirmed the plain `vX.Y.Z` milestone exists and contains every piece
      of scheduled implementation work plus the release-gate issue. No
      `vX.Y.Z` label, Project field, grouping label, title, or body text is being
      treated as a second scheduling axis.

- [ ] **The release gate is the final pre-tag issue**
      I confirmed every other issue in the target milestone is closed, moved to
      another exact version milestone, or explicitly cut. The gate will be
      closed before the signed local tag is created, and the exact-milestone guard
      must pass afterward.

- [ ] **No known issues being silently shipped**
      I reviewed the target milestone and unscheduled GitHub Issues for known
      defects or outstanding decisions that affect this release's correctness
      or safety. Anything knowingly deferred is acknowledged in the CHANGELOG
      or a documented follow-on issue with a valid scheduling state.

- [ ] **Tagged `main` is the release boundary**
      I confirmed every repo-resident release fact that must ship with this
      version is already on synced `main` before tagging. The release does not
      depend on a manual post-publish merge to make README, changelog, release
      notes, runbooks, or verification docs accurate.

- [ ] **Post-publication evidence has an external home**
      I confirmed the tag workflow, finalized GitHub Release, registry records,
      and direct delivery witness will retain publication evidence without a
      manual evidence-backfill commit.

### Notes

_Add any relevant context, known deferred issues, or reviewer observations._

---

**By checking all boxes above, the reviewer attests that the release meets the
human-judgment requirements defined in `docs/governance/RELEASE_POLICY.md`.**
