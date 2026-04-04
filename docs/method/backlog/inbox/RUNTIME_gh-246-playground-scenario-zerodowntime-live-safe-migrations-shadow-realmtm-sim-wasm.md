# GH-246 Playground scenario: Zero‑downtime live safe migrations (SHADOW REALM™ sim + WASM PG apply)

- Imported from: GitHub issue
- Issue: #246
- URL: https://github.com/flyingrobots/wesley/issues/246
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:33Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Playground scenario: Zero‑downtime live safe migrations (SHADOW REALM™ sim + WASM PG apply)

## Overview

Demonstrate the expand/backfill/validate/switch/contract choreography with a visual timeline. Simulate locks and reads/writes safety in the browser; optionally apply plan to WASM PG with small data and show EXPLAIN/timing when possible.

## Acceptance Criteria


## Definition of Done

- Tests / validation: User can step through phases and see consistent results across runs; WASM PG path works when enabled.
- Docs / comms touched: Add a “How zero‑downtime works” panel with links to docs.

## Links

- Primary reference: `docs/drafts/playground-demo-scenarios.md`

**Estimate:** 8h
