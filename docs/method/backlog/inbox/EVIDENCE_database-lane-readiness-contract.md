# Database Lane Readiness Contract

- Lane: `inbox`
- Legend: `EVIDENCE`

## Why now

The old README described Wesley as a `production-ready` and `battle-tested`
PostgreSQL backend compiler while the repo still marks itself experimental and
the current evidence surface remains uneven.

That gap should not live only as "marketing cleanup." Either Wesley can prove a
release-grade database-change claim, or the public contract needs to stay
narrower on purpose.

## Hill

The repo can name one explicit readiness contract for the current
database-change lane and show which evidence does and does not justify the
public claim level.

## Done looks like

- the repo defines what `experimental`, `alpha`, `production-ready`, or any
  equivalent public readiness label actually means for Wesley
- the current database-change lane is graded against that contract with
  repo-visible evidence
- the front-door docs stop mixing strong readiness language with weaker proof
- if the lane is not ready for a stronger label, the gap is recorded without
  euphemism

## Repo Evidence

- old `README.md` at commit `6672939`
- current `README.md`
- `ROADMAP.md`
- `docs/VISION.md`
- `docs/guides/quick-start.md`
- `test/README.md`
