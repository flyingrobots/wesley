---
title: Milestone
template_type: milestone
audience: product, engineering
usage: "Define milestone objectives, workstreams, and tracking checkpoints."
synced_issue_template: ""
status: canonical
---


# Milestone: Wesley in the Browser

## Objective

Deliver a first-class "host-browser" adapter that lets Wesley's core compile GraphQL schemas inside the browser and powers a public playground demo, proving the hexagonal architecture works beyond Node.

## Success Criteria

- [ ] Host-browser adapter package exposes a stable `transform()` API that mirrors the Node host behavior.
- [ ] Browser bundle passes automated regression tests against the existing fixture suite.
- [ ] Public playground page can transform sample SDL and render generated artifacts without server-side execution.

## Timeline

- **Start Date:** 2025-10-27
- **Target Completion:** 2025-12-08
- **Key Reviews:** 2025-11-07 (architecture review), 2025-11-24 (adapter demo), 2025-12-05 (playground UX sign-off)

## Workstreams

| Workstream | Description | Owner | Status | Budget | Notes |
| --- | --- | --- | --- | --- | --- |
| Browser Architecture & RFC | Finalize adapter contracts, storage strategy, and RFC sign-off | @flyingrobots | not_started | 2 weeks; decisions logged; ≤ 3 open risks | Aligns with new RFC in `docs/features/host-browser.md` |
| Core Adapter Implementation | Implement `@wesley/host-browser` with in-memory ports + caching | @flyingrobots | not_started | API parity; perf within 5% of Node on fixtures | Target issue WB-002 |
| Build & Packaging | Configure Rollup/Vite pipeline and WASM/web builds with validation | @flyingrobots | not_started | ≤ 500 KB gzip core; init ≤ 200 ms (M1) | Target issue WB-003 |
| Playground Experience | Ship Astro/Mantine playground UI + telemetry hooks | @flyingrobots | not_started | FCP ≤ 1.5 s (M1); TTI ≤ 2.5 s | Target issue WB-004 |

## Dependencies

- [ ] RFC accepted (owner @flyingrobots, due 2025-11-01)
- [ ] Hexagonal core audit complete to confirm no residual Node imports (owner @flyingrobots, due 2025-11-04)
- [ ] Legal/license review for browser distribution of dependencies (owner @flyingrobots, due 2025-11-18)

## Risks & Mitigations

- **Risk:** Browser bundle size or WASM init time degrades UX.
  - **Impact:** Slow page loads prevent meaningful demos.
  - **Mitigation:** Establish size budgets, lazy-load secondary features, and benchmark early in WB-003.

- **Risk:** Unexpected Node-only assumptions in core break browser build.
  - **Impact:** Adapter work stalls.
  - **Mitigation:** Run dependency-cruiser + unit tests inside Web Test Runner during WB-002 spike.

## Checkpoints

- Architecture approval — 2025-11-07 — RFC reviewed and risks logged.
- Adapter alpha — 2025-11-24 — Demo transforming sample SDL in browser dev build.
- Playground beta — 2025-12-05 — Internal dogfood with telemetry enabled.

## Reporting

- **Status Updates:** Weekly async update every Friday in #wesley-dev, milestone doc refreshed bi-weekly.
- **Dashboards / Metrics:** Bundle size dashboard (Calibre), adapter test matrix (GitHub Actions workflow).
- **Docs / Notes:** RFC (`docs/features/host-browser.md`), playground design notes (Notion link TBD).

## Post-Milestone

- [ ] Retro scheduled
- [ ] Documentation updated
- [ ] Celebrate wins / recognise contributors
