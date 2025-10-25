---
title: RFC
template_type: rfc
audience: engineering, product, design
usage: "Share context, pitch changes, and solicit feedback on major proposals."
synced_issue_template: ""
status: canonical
---


# RFC: Wesley Host-Browser Adapter & Playground

## Summary

Extend Wesley's hexagonal architecture with a browser host adapter and public playground that execute schema transformations entirely client-side, enabling instant try-before-install experiences while reusing the existing core domain logic.

## Authors & Reviewers

- **Authors:** @flyingrobots, @wesley-core-team
- **Reviewers Requested:** @platform-engineering, @dx-experience, @security-review
- **Stakeholders:** Product (DX), Marketing, Developer Relations

## Status

- Proposed on: 2025-10-23
- Current state: draft
- Target decision date: 2025-11-07

## Motivation

- Browser-based onboarding removes the need for local Node installs and showcases Wesley's “GraphQL in → Everything out” in seconds.
- The hexagonal architecture promises portability; delivering a browser host validates that investment and surfaces any remaining Node coupling.
- Marketing and Developer Relations need an interactive demo for conferences and site visitors, unlocking top-of-funnel growth.

## Goals

- Ship a supported `@wesley/host-browser` package with API parity for transform/plan/test generation.
- Provide a production-ready playground UI embedded in the Astro docs site.
- Establish build, size, and telemetry guardrails for ongoing maintenance.

## Non-Goals

- Supporting legacy browsers without modern ESM/CSP features.
- Persisting user schemas or providing authentication (future iteration).
- Replacing the existing Node host or CLI.

## Background

- Wesley core is dependency-free and currently served by `@wesley/host-node` for CLI usage.
- The Nitro + Mantine docs site already exists and can host a new playground page.
- Prior research (WB-001) will confirm the absence of Node-only assumptions and inform storage decisions.

## Proposed Approach

- Implement a browser host adapter that satisfies the same port interfaces as `@wesley/host-node`, substituting in-memory/IndexedDB storage for filesystem operations.
- Bundle the core + adapter using Rollup/Vite into ESM artifacts with optional web-worker support.
- Integrate the adapter into an Astro/Mantine playground page that renders editors, results, and download/export tools.

## Detailed Design

### Architecture

The adapter will expose:

- `transform({ sdl, options }): Promise<BrowserArtifacts>`
- `plan({ current, next }): Promise<PlanArtifacts>`
- `generateTests({ sdl }): Promise<TestArtifacts>`

Storage is abstracted behind a lightweight interface with default in-memory implementation and optional IndexedDB backend for larger artifacts. A feature flag selects storage at runtime.

A bundler entrypoint wires the adapter to Wesley core, configures safe polyfills, and optionally hosts a worker entry to offload heavy computations.

### APIs / Contracts

| Interface | Change | Impact |
| --- | --- | --- |
| `@wesley/host-browser` exports | New module providing adapter APIs | Playground, third-party integrations |
| `packages/wesley-core` ports | Potential minor adjustments to accept async storage | All hosts |
| Website playground route | New `/playground` page | Marketing site visitors |

### Data & Storage

- IndexedDB used for optional caching; fallback to in-memory for ephemeral sessions.
- Artifacts stored per-run; download bundler packages them as ZIP.
- No PII stored; telemetry aggregated and anonymized.

### Security & Privacy

- Enforce CSP-friendly bundles (no `eval`).
- Telemetry limited to success/failure metrics; feature flag for opt-out.
- Document that uploaded schemas remain client-side unless user explicitly downloads/shares.

### Operational Considerations

- CI job builds and tests browser bundle for Chrome & Firefox.
- Bundle size tracked via Calibre/bundlewatch with budgets.
- Playground deployed through existing Astro build (netlify/vercel pipeline) behind feature flag until GA.

## Alternatives Considered

- **Alternative:** Serverless API executing Node host.
  - **Pros:** Lower engineering effort, reuse existing host.
  - **Cons:** Introduces latency, requires ops, contradicts “zero install” promise.
- **Alternative:** WebAssembly port of Node runtime.
  - **Pros:** High fidelity environment.
  - **Cons:** Significant engineering cost, larger bundle, limited browser support.

## Open Questions

- Should we ship a worker-based entrypoint by default or keep it optional?
- Do we need graceful degradation for Safari IndexedDB limitations?
- What analytics platform best fits privacy requirements?

## Timeline

| Phase | Owner | ETA | Notes |
| --- | --- | --- | --- |
| Architecture Spike (WB-001) | TBD | 2025-11-05 | Produce final plan & update RFC |
| Adapter Implementation (WB-002) | TBD | 2025-11-28 | Includes browser test suite |
| Build Pipeline (WB-003) | TBD | 2025-12-02 | Size budgets + smoke tests |
| Playground UI (WB-004) | TBD | 2025-12-06 | Launch beta behind flag |

## Appendix

- Milestone doc: `meta/milestones/wesley-in-the-browser.md`
- Issues: WB-001, WB-002, WB-003, WB-004
- Prior art: Svelte REPL, Prisma Data Platform Playground
