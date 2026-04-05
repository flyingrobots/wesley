# GH-255 WASM PG: Apply DDL and annotate unsupported features

- Imported from: GitHub issue
- Issue: #255
- URL: https://github.com/flyingrobots/wesley/issues/255
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:45Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

Apply generated plan to the WASM engine; annotate unsupported DDL and limits; surface EXPLAIN if available.\n\nDeliverable: status per statement and optional EXPLAIN block.
