# GH-242 Optional WASM Postgres engine (beta) with strict no‑cache mode + capability panel

- Imported from: GitHub issue
- Issue: #242
- URL: https://github.com/flyingrobots/wesley/issues/242
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:27Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:frontend-adapters`, `Website`, `Tracking`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Optional WASM Postgres engine (beta) with strict no‑cache mode + capability panel

## Overview

Add an optional “Real PG (WASM, beta)” engine for the Playground. Instantiate Postgres‑to‑WASM in a Worker without persistent mounts (no OPFS/IDB), keep it memory‑only, and surface the capability panel with clear limitations and load‑time warnings.

## Acceptance Criteria

- [ ] Lazy‑load the WASM bundle on demand; show loading/progress.
- [ ] Instantiate engine in a Worker without persistence; teardown on reset.
- [ ] Apply generated DDL; surface unsupported features and EXPLAIN/lock limitations.
- [ ] Update capability matrix in UI; warn when features require a real server.

## Definition of Done

- Tests / validation: Toggle to WASM PG; apply DDL; run a simple query; reset wipes state.
- Docs / comms touched: Document WASM PG constraints and non‑persistence guarantees; link to `docs/drafts/playground-db-strategy.md`.

## Links

- Primary reference: `docs/drafts/playground-db-strategy.md`
- Related issues / PRs: #241

**Estimate:** 8h

---
## Tracking (child deliverables)
- #255 WASM PG: Apply DDL and annotate unsupported features
- #254 WASM PG: Worker harness (memory-only, no persistence)
- #253 WASM PG: lazy loader + loader UI

> 1 issue = 1 deliverable. Use this issue to track children, not work.
