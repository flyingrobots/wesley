# Release Checklist

<!-- docs-truth: status=current owner=@flyingrobots -->

This is the human sign-off template for Wesley releases. Copy this checklist
into the release PR body and complete it before creating the release tag.

Automated checks are not listed here — those run inside
`cargo xtask release-guard --tag vX.Y.Z` and block CI automatically.
This checklist covers checks 7, 10, 13, and 22 from the enforcement matrix,
which require human judgment.

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

- [ ] **No known issues being silently shipped**
  I reviewed the open GitHub Issues for known defects or outstanding decisions
  that affect this release's correctness or safety, whether or not they are
  already marked as release issues. Anything knowingly deferred is acknowledged
  in the CHANGELOG or a documented follow-on issue.

### Notes

_Add any relevant context, known deferred issues, or reviewer observations._

---

**By checking all boxes above, the reviewer attests that the release meets the
human-judgment requirements defined in `docs/governance/RELEASE_POLICY.md`.**
