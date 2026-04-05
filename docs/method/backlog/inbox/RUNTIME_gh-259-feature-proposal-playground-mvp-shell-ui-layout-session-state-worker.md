# GH-259 Feature Proposal: Playground MVP Shell — UI layout, session state, worker interface

- Imported from: GitHub issue
- Issue: #259
- URL: https://github.com/flyingrobots/wesley/issues/259
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:46Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Feature Proposal: Playground MVP Shell — UI layout, session state, worker interface

## Opportunity
- Problem: Visitors can’t “try Wesley” without installing it; we need a fast, zero‑install first impression.
- Affected Users: New evaluators, PMs, devs skimming docs.
- Impact if Solved: Higher engagement and comprehension; foundation for deeper demos.
- Validation Evidence: Prior requests for interactive docs; this milestone.

## Proposed Solution
Scaffold an in‑browser Playground shell (no engine logic yet):
- Route/page with a two‑pane layout (Editor left; Outputs right with tabs: Artifacts, HOLMES, Timeline, DB Query).
- Top toolbar: DB Engine selector (pg‑mem default, WASM PG disabled), Run/Plan/Rehearse buttons (stubbed), Reset Session.
- Session state store (engine, artifacts, bundle, events) and a small event bus API.
- Worker interface contracts for generator/db/HOLMES (stub implementations).

## Value Proposition
- Instant demo of end‑to‑end flow shape without backend.
- Creates seams for granular work (pg‑mem worker, apply DDL, query panel, etc.).

## Alternatives Considered
- Jump straight into engines without a cohesive shell — rejected; leads to ad hoc UI and rework.

## Scope & Constraints
- Initial Scope: UI layout + state + worker contracts + placeholders; no DB/engine logic.
- Out of Scope: Actual DDL apply, query exec, HOLMES integration (handled by child issues).
- Constraints: Keep initial bundle small; no persistence.

## Dependencies
- None. This issue will BLOCK #248–#252 and scenario issues #243–#245.

## Success Metrics
- Shell loads fast; buttons and tabs wired; state resets cleanly; children can plug in without refactor.

## Effort Estimate (T-Shirt)
- Engineering: S (≈ 3–5h)
- Design: XS (layout from existing Mantine patterns)
- GTM / Ops: XS

## Open Questions
- Any specific copy/branding for the Playground header?
- Final tab names OK (Artifacts/HOLMES/Timeline/Query)?

## Next Steps

---
## Checklist
- [ ] Create Playground route/page and two-pane layout
- [ ] Add toolbar: Engine selector, Run/Plan/Rehearse (stubs), Reset
- [ ] Implement session state store (engine, artifacts, bundle, events)
- [ ] Define worker interfaces for generator/db/holmes (stubs only)
- [ ] Wire tabbed Outputs (Artifacts, HOLMES, Timeline, Query)
