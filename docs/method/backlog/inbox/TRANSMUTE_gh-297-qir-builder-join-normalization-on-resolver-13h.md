# GH-297 qir(builder): join normalization + ON resolver (1–3h)

- Imported from: GitHub issue
- Issue: #297
- URL: https://github.com/flyingrobots/wesley/issues/297
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:26Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `enhancement`, `group:qir-phase-c`, `dx`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

Scope\n- Normalize joins to INNER/LEFT with a small ON resolver that validates referenced tables/columns and disallows ambiguous refs.\n- Add friendly diagnostics with suggested fixes.\n\nAcceptance\n- Builder accepts explicit join objects; invalid joins error with precise messages.\n- Unit tests cover valid/invalid cases.\n\nLinks: #67 (tracker).
