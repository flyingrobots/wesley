# GH-254 WASM PG: Worker harness (memory-only, no persistence)

- Imported from: GitHub issue
- Issue: #254
- URL: https://github.com/flyingrobots/wesley/issues/254
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:43Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

Instantiate Postgres‑to‑WASM in a Worker without OPFS/IDB; teardown on reset.\n\nDeliverable: Worker init/apply/query lifecycle confirmed.
