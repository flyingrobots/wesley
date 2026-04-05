# GH-301 qir(pagination): DISTINCT ON helper lowering (2–3h)

- Imported from: GitHub issue
- Issue: #301
- URL: https://github.com/flyingrobots/wesley/issues/301
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:30Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `enhancement`, `group:qir-phase-c`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

Scope\n- Introduce a DISTINCT ON helper in lowering; deterministic tie‑breakers via pkResolver.\n\nAcceptance\n- Example compiles; ordering stable; docs updated.\n\nLinks: #70.
