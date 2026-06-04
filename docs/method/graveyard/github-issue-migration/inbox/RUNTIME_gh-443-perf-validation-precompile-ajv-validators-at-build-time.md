# GH-443 perf(validation): precompile Ajv validators at build time

- Imported from: GitHub issue
- Issue: #443
- URL: https://github.com/flyingrobots/wesley/issues/443
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:19:39Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Source: BACKLOG.md

Migrate the old backlog item into GitHub tracking. Evaluate pre-compiling JSON Schema validators into standalone JS during build so validation stays fast and runtime dependencies stay lean.

Done when:

- a build-time validator generation path exists
- runtime behavior matches the current validator semantics
- cold-start/runtime tradeoffs are documented
