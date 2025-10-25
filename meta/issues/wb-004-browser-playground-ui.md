---

## Additional Notes

Loop in DX/Docs teams for copy and onboarding flows; capture analytics requirements early.

## Dependencies

- **Blocked by:** [WB-002](./wb-002-implement-host-browser-adapter.md), [WB-003](./wb-003-browser-build-pipeline.md)

# [WB-004] Browser Playground Experience

## Overview

Create an Astro/Mantine-powered playground that runs entirely client-side using the browser adapter. Users can paste GraphQL SDL, run Wesley, view generated artifacts, and download bundles.

## References & Assets

- [ ] Figma / Design: TBD (link when ready)
- [ ] Product Spec: `docs/features/host-browser.md`
- [ ] Related Issues / PRs: WB-002, WB-003
- [ ] Feature Flags / Experiments: n/a
- [ ] Other Assets: `website/` Astro site

## User Story

As a **prospective Wesley user**, I want **to try Wesley in the browser with my schema**, so that **I can see the value instantly without installing tooling**.

## Acceptance Criteria

- [ ] Playground UI supports input schema editor (monaco or codemirror) with syntax highlighting.
- [ ] Running transform displays artifacts in tabbed panels (SQL, migrations, types, tests, scores).
- [ ] Errors rendered with actionable messaging and link to docs.
- [ ] Export button downloads generated artifacts as ZIP.
- [ ] Basic telemetry captured (runs, errors, size) with privacy notice.

## Definition of Done

Playground deployed behind feature flag, documented, and integrated into marketing site with monitoring dashboards.

## Scope

### In-Scope

- UI, state management, integration with browser adapter, telemetry hooks.

### Out-of-Scope

- Authentication, schema persistence across sessions (future iteration).

### Deliverables

- **Est. Lines of Code:** 800-1100 (UI components + state)
- **Est. Blast Radius:** `website/`, new analytics scripts

## Implementation Details

### High-Level Approach

Extend the Astro/Mantine site, embed React components for editor/viewer, use browser adapter for execution, and integrate analytics/feature flags.

### Affected Areas

- website/src/pages/playground.astro (new)
- website/src/components/playground/**/* (new)
- website/src/styles (updates)

### Implementation Steps

- [ ] Prototype editor + results layout using Mantine + CodeMirror.
- [ ] Wire adapter invocation with cancellable runs and loading states.
- [ ] Implement artifact viewers (tabs, copy buttons, download bundle).
- [ ] Add telemetry + feature flag guard; document usage.

## Test Plan

### Happy Path

- [ ] Transform default sample schema shows artifacts in < 2s on desktop.

### Edge Cases

- [ ] Large schema (~5MB) warns about size but still processes eventually.
- [ ] Invalid SDL surfaces error banner with helpful stack trace.

### Failure Cases

- [ ] Network telemetry failures fail silently without blocking usage.

### Monitoring & Success Metrics

- [ ] Track run success rate, median execution time, and error frequency.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Desktop Chrome | Playground | TBD | pending | |
| Desktop Firefox | Playground | TBD | pending | |
| Mobile Safari | Playground | TBD | pending | MVP ensures responsive layout |

## Requirements

### Hard Requirements

- Works offline once assets cached.

### Soft Requirements

- Provide “copy to clipboard” shortcuts for each artifact.

### Runtime Requirements

- Runs on evergreen browsers (Chrome/Firefox/Safari latest) with no server dependency.

### Dependencies & Approvals

- [ ] WB-002 completed
- [ ] WB-003 bundle available

---

## Production Notes

### Priority: 4 / 5

High value for adoption once adapter ready.

### Complexity: 4 / 5

Significant UI + performance considerations.

### Estimate: 120 - 160 hours

Includes design collaboration, UX polish, and testing across browsers.

### Risk & Rollback

- **Primary Risks:** Performance stalls on large schemas, telemetry privacy concerns.
- **Mitigations:** Stream results, enforce size guardrails, coordinate with legal for analytics.
- **Rollback / Kill Switch:** Feature flag to disable playground route if issues arise.
