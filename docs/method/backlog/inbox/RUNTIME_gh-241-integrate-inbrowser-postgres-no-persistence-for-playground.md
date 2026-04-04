# GH-241 Integrate in‑browser Postgres (no persistence) for Playground

- Imported from: GitHub issue
- Issue: #241
- URL: https://github.com/flyingrobots/wesley/issues/241
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:26Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:frontend-adapters`, `Website`, `Tracking`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Integrate in‑browser Postgres (no persistence) for Playground

## Overview

Use PGlite as the default in‑browser Postgres emulator for the Wesley Playground. Runs entirely in the browser, strictly memory‑only (can use IndexedDB), with a capability panel to explain unsupported features.

## Acceptance Criteria

- [ ] Expose a small SQL query panel to run simple SELECTs against the in‑memory DB.
- [ ] Guarantee non‑persistence: memory‑only data structures; a `Reset session` button wipes engine state.
- [ ] Show a **Capability** panel (matrix) summarizing supported/partial/unsupported features.

## Definition of Done

- [ ] Tests / validation: 
  - [ ] Sample SDL generates and applies
  - [ ] A basic SELECT returns rows
  - [ ] Reset button that wipes state.
- [ ] Docs / comms touched: Document the Postgres engine and limitations in the Playground docs; link to `docs/drafts/playground-db-strategy.md`.

## Links

- Primary reference: `docs/drafts/playground-db-strategy.md`
- Related issues / PRs: #WB-004 (playground UI doc), #231 (config for schema paths)

**Estimate:** 8h

---

## Tracking (child deliverables)
- #252 Capability panel + Reset session (non‑persistence guarantee)
- #251 Query panel: basic SELECT runner
- #250 DDL apply: annotate per‑statement status (applied/emulated/skipped)
- #249 pg‑mem Worker bootstrap (init/apply/query harness)
- #248 Playground: DB engine selector UI (toggle)

> 1 issue = 1 deliverable. Use this issue to track children, not work.
