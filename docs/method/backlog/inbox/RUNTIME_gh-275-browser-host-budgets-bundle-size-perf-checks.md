# GH-275 Browser host budgets: bundle size + perf checks

- Imported from: GitHub issue
- Issue: #275
- URL: https://github.com/flyingrobots/wesley/issues/275
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:55Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `ci`, `host`, `progress`, `pkg:wesley-host-browser`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Add bundle size/perf checks to browser-smoke.

- Fail if bundle exceeds X kB (configurable).
- Record timing metric; feed into progress gates once stable.
