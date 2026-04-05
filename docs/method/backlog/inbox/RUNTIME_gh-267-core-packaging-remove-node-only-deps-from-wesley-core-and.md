# GH-267 Core packaging: remove Node-only deps from @wesley/core and drop engines

- Imported from: GitHub issue
- Issue: #267
- URL: https://github.com/flyingrobots/wesley/issues/267
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:51Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Make @wesley/core fully host-agnostic so Browser/Deno/Bun builds don’t drag Node shims.

Why
- Core should be pure ESM with zero Node deps to support non-Node hosts.

What
- Move Node-only deps out of core:
  - `chokidar` → used by CLI watch; move to `@wesley/cli`.
  - `ts-morph` → only used by JS generator; move to `@wesley/generator-js`.
- Remove `engines.node` from `@wesley/core` (keep it in host packages).
- Add a check in preflight to fail if core declares Node engines or Node-only deps.

Acceptance
- `@wesley/core` installs on Deno/Bun/browser bundlers without Node shims.
- Preflight blocks regressions.
