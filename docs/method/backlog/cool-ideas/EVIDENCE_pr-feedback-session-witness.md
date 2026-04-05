# PR Feedback Session Witness

- Lane: `cool-ideas`
- Legend: `EVIDENCE`

## Why now

Closing out a review session on PR #467 required building the same witness by
hand in multiple places: issue-to-SHA mapping, validation commands, unresolved
thread count, bot verdict, and current merge blockers. That information exists,
but the witness is assembled manually rather than emitted from one reproducible
surface.

## Hill

A maintainer can generate one review-session witness artifact that records what
feedback was addressed, which SHAs carried each fix, what validation ran, and
what blockers remained at session close.

## Done looks like

- one local-first artifact captures issue-to-SHA mapping for a review session
- validation commands and outcomes are recorded alongside the fix summary
- unresolved-thread count and live merge blockers are captured at generation
  time
- the witness can be rendered into a PR comment table without hand-copying
- the artifact is boring enough to reuse across agent or human review passes

## Repo Evidence

- `docs/invariants/evidence-truth.md`
- `docs/invariants/provenance-visibility.md`
- `docs/method/retro/README.md`
- `docs/method/backlog/inbox/RUNTIME_gh-447-tooling-gh-add-a-deterministic-pr-review-thread-helper-for.md`

## Related Carry-Over

- `#447`
