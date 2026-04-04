# GH-245 Playground scenario: Postgres migrations that just work (plan + idempotence)

- Imported from: GitHub issue
- Issue: #245
- URL: https://github.com/flyingrobots/wesley/issues/245
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:32Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Playground scenario: Postgres migrations that just work (plan + idempotence)

## Overview

Demonstrate planning and applying non‑breaking migrations in the browser engine(s), with idempotence checks and a plan trace.

## Acceptance Criteria

- [ ] Edit SDL (add column with default; new index) and Plan.
- [ ] Apply plan to `pg-mem`/WASM PG; show per‑step status and any emulations.
- [ ] Re‑apply to verify idempotence (no changes); render plan trace.
- [ ] HOLMES “Migration Risk” gate turns ✅.

## Definition of Done

- Tests / validation: Re‑apply result is a no‑op; state matches expectations.
- Docs / comms touched: Explain idempotence checks in the UI.

## Links

- Primary reference: `docs/drafts/playground-demo-scenarios.md`

**Estimate:** 5h
