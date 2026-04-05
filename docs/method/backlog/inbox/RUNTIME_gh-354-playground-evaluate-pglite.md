# GH-354 Playground: Evaluate PGlite

- Imported from: GitHub issue
- Issue: #354
- URL: https://github.com/flyingrobots/wesley/issues/354
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:46:17Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `Website`, `Playground`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: label match: Website/Playground surfaces are runtime/operator-facing queue items.

## Original Issue

### Problem Statement

Instead of using pg-mem, we'll be using PGlite. Why? PGlite is Postgres compiled to WASM, pg-mem is emulated.

| Factor | PGlite | pg-mem |
|--------|--------|--------|
| Fidelity to real Postgres (DDL, extensions, behaviours) | High | Lower |
| In-browser + persistence support | ✔ (IndexedDB etc) | ✔ (in-memory + browser) |
| Production-style or complex schema support | Good | Probably risky |
| Complexity of setup/integration | Moderate (you’ll still test carefully) | Low  (lighter) |
| Use case fit (your GraphQL→DDL→instance scenario) | Strong | Weak to moderate |
| Risk of divergence when you “promote” to real Postgres | Lower | Higher |

## In-Scope

- [ ] Lean how to integrate with Wesley Website deployments
- [ ] Confirm that it works
- [ ] Confirm that it supports common pg extensions
- [ ] Try standing up a moderately complex DDL
- [ ] Try migration
- [ ] Try some queries

## Out-of-Scope

- Integrate deployment with Wesley Wesbite (will be its own task)

### Proposed Solution

1. Install PGlite
2. Evaluate suitability for Wesley Website integration/Wesley in the browser demo needs

### Alternatives Considered

- `pg-mem` but chosen over this because it's more fully featured

### Impact Areas

- [ ] CLI
- [ ] Docs
- [ ] API
- [x] Infra/CI
- [ ] Other

### Priority

None
