# Review Supersession Explainer

- Lane: `cool-ideas`
- Legend: `RUNTIME`

## Why now

GitHub's review model keeps historical `CHANGES_REQUESTED` reviews visible even
after every actionable thread has been resolved and a later bot review has
approved the new push. During PR #467, that made `reviewDecision` and the raw
review list look harsher than the live thread state actually was.

## Hill

A maintainer can tell which review requests are still live, which ones are
historical but superseded, and why GitHub's aggregate review state does or does
not match the actual unresolved feedback surface.

## Done looks like

- one report distinguishes active change requests from superseded review history
- the explanation names which unresolved threads, approvals, or later commits
  changed the effective state
- historical review noise no longer forces maintainers to hand-audit every
  review event
- the output stays explainable enough to paste into PR summary comments if
  needed
- the logic is documented so future agents do not reinvent the same heuristics

## Repo Evidence

- `AGENTS.md`
- `docs/method/process.md`
- `docs/method/guide.md`
- `docs/invariants/docs-runtime-honesty.md`

## Related Carry-Over

- `#447`
