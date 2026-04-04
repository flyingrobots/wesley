# GH-307 dx(cli): watch mode for ops + manifest (2–3h)

- Imported from: GitHub issue
- Issue: #307
- URL: https://github.com/flyingrobots/wesley/issues/307
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:35Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `enhancement`, `group:qir-phase-c`, `dx`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

Scope\n- Recompile ops on change; throttle; stable logs; respect manifest.\n\nAcceptance\n- --watch rebuilds changed ops; tests assert incremental behavior.\n\nLinks: #129.
