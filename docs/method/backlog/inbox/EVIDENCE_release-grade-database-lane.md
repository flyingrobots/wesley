# Release-Grade Database Lane

- Lane: `inbox`
- Legend: `EVIDENCE`

## Why now

The old README described Wesley as a `production-ready` and `battle-tested`
PostgreSQL backend compiler before the repo could justify that claim cleanly.
That was too strong as current truth, but the direction is still correct.

This packet keeps the stronger goal alive as an explicit target instead of
letting it disappear into generic docs cleanup.

## Hill

Wesley earns one explicit readiness contract for its primary database-change
lane and can justify stronger public readiness language with repo-visible
evidence.

## Done looks like

- the repo defines what `experimental`, `alpha`, `production-ready`, or any
  equivalent public readiness label actually means for Wesley
- the current database-change lane is graded against that contract with
  repo-visible evidence
- stronger public readiness language returns only when the evidence supports it
- if the lane is not ready for a stronger label, the current contract stays
  narrower without losing the longer-term goal

## Repo Evidence

- old `README.md` at commit `6672939`
- current `README.md`
- `ROADMAP.md`
- `docs/VISION.md`
- `docs/guides/quick-start.md`
- `test/README.md`
