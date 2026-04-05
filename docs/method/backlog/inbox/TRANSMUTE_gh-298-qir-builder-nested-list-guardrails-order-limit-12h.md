# GH-298 qir(builder): nested list guardrails (order/limit) (1–2h)

- Imported from: GitHub issue
- Issue: #298
- URL: https://github.com/flyingrobots/wesley/issues/298
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:27Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `enhancement`, `tests`, `group:qir-phase-c`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

Scope\n- Enforce explicit orderBy and limit for lists; compile COALESCE(jsonb_agg(...), '[]'::jsonb).\n\nAcceptance\n- Missing order/limit yields a clear error.\n- Tests prove COALESCE semantics.\n\nLinks: #67.
