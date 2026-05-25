# GH-269 CI: cross-host smoke tests

- Imported from: GitHub issue
- Issue: #269
- URL: https://github.com/flyingrobots/wesley/issues/269
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:54Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `ci`, `tests`

## Post-Retirement Note

This import predates the legacy Node host deletion. Its original Node and
`@wesley/core` acceptance text is obsolete. Retained repo-local coverage now
belongs to browser, Deno, and Bun external host experiments with self-contained
smokes; future Node execution evidence needs a new adapter design and must not
restore the deleted host package.

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

Add minimal smoke tests to prove multi-host viability (Node, Deno, Bun, Browser).

What

- Node: already covered.
- Deno: run a script that imports `@wesley/core` via npm: interop and executes one function.
- Bun: import `@wesley/core` and run a tiny pipeline.
- Browser: build a tiny bundle and run a Playwright test that executes one operation in a Web Worker; assert outputs in-memory.

Acceptance

- CI job(s) exercising all four hosts with <60s added runtime and artifact logs for debugging.
