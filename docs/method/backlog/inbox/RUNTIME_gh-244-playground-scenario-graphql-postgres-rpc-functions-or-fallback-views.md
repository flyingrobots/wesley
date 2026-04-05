# GH-244 Playground scenario: GraphQL → Postgres RPC (functions or fallback views)

- Imported from: GitHub issue
- Issue: #244
- URL: https://github.com/flyingrobots/wesley/issues/244
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:30Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

# Playground scenario: GraphQL → Postgres RPC (functions or fallback views)

## Overview

Show the QIR path from GraphQL ops to SQL functions (wes_ops). In `pg-mem`, where functions are limited, provide a fallback to SQL views so the demo remains runnable.

## Acceptance Criteria

- [ ] Compile example ops → emit SQL functions.
- [ ] If `CREATE FUNCTION` unsupported, emit equivalent VIEWs for the playground engine.
- [ ] Apply artifacts; run a sample SELECT to demonstrate the RPC behavior.
- [ ] HOLMES reflects RPC artifacts in evidence and sub‑metrics.

## Definition of Done

- Tests / validation: Products_by_name returns expected rows in both function (WASM PG) and view (pg‑mem) modes.
- Docs / comms touched: Document the fallback and the reason.

## Links

- Primary reference: `docs/drafts/playground-demo-scenarios.md`

**Estimate:** 5h
