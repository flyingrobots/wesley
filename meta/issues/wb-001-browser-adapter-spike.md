# [WB-001] Browser Host Architecture Spike

## Overview

Run a focused spike to validate how Wesley's hexagonal ports map to a browser host, identify Node-specific gaps, and evaluate storage/cache strategies (IndexedDB, OPFS, in-memory). Output should be a concrete execution plan for the remaining tasks.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec (Notion / Confluence): n/a
- [ ] Related Issues / PRs: WB-002, WB-003, WB-004
- [ ] Feature Flags / Experiments: n/a
- [ ] Other Assets: `docs/features/host-browser.md`

## Dependencies

- **Blocks:** [WB-002](./wb-002-implement-host-browser-adapter.md), [WB-003](./wb-003-browser-build-pipeline.md)

## Additional Notes

Document findings in `docs/features/host-browser.md` and attach benchmark artifacts to the RFC.

## User Story

As a **Wesley maintainer**, I want **clear constraints for running Wesley in the browser**, so that **later implementation work proceeds without architectural surprises**.

## Acceptance Criteria

- [ ] Audit `@wesley/core` for any Node-dependent imports or side effects and document findings.
- [ ] Produce a comparison of browser storage options (in-memory, IndexedDB, Cache API, OPFS) with recommendation for artifact caching.
- [ ] Validate that GraphQL parsing and code generation packages bundle cleanly with Vite/Rollup targeting modern browsers.
- [ ] Update the host-browser RFC with spike results and open questions.

## Definition of Done

Spike summary merged into RFC, action items filed on follow-up issues, and no unresolved blockers left for implementation tasks.

## Scope

### In-Scope

- Dependency analysis
- Storage strategy research
- Build/bundle feasibility checks

### Out-of-Scope

- Implementing the adapter
- Building UI playground

### Deliverables

- **Est. Lines of Code:** < 100 (mostly scripts/notes)
- **Est. Blast Radius:** `packages/wesley-core`, `scripts/` (temporary tooling)

## Implementation Details

### High-Level Approach

Run dependency-cruiser and custom scripts to surface Node imports, experiment with Vite bundling in a throwaway branch, and benchmark storage APIs via small prototypes.

### Affected Areas

- packages/wesley-core
- scripts/spikes (temporary)
- docs/features/host-browser.md

### Implementation Steps

- [ ] Run dependency audits and document Node-specific touchpoints.
- [ ] Prototype bundling with Vite + Rollup configuration targeting ESM browsers.
- [ ] Benchmark storage APIs for write/read throughput using sample artifacts.
- [ ] Summarize results and update RFC + milestone doc.

## Test Plan

### Happy Path

- [ ] Dependency audit script executes without errors and reports no false positives.

### Edge Cases

- [ ] Validate bundling under both dev and production modes.

### Failure Cases

- [ ] Document any blockers that prevent bundling so they can be addressed in WB-002/003.

### Monitoring & Success Metrics

- [ ] Time to initialize prototypes recorded for future regression tracking.

### QA Sign-off Matrix

| Environment | Surface (browser / device / API) | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Spike | Desktop Chrome | TBD | pending | Compare with Firefox if time permits |

## Requirements

### Hard Requirements

- Spike results must live in version-controlled docs.

### Soft Requirements

- Coordinate with infra on storage security implications.

### Runtime Requirements

- Prototypes must avoid leaking data outside the dev sandbox.

### Dependencies & Approvals

- [ ] RFC authors sign-off on spike scope

## Production Notes

### Priority: 4 / 5

Milestone cannot proceed without validated plan.

### Complexity: 2 / 5

Primarily investigative work with light prototyping.

### Estimate: 16 - 24 hours

Two to three half-day sessions for audits, prototyping, and write-up.

### Risk & Rollback

- **Primary Risks:** Underestimating hidden Node dependencies.
- **Mitigations:** Escalate findings immediately and convert to follow-up issues.
- **Rollback / Kill Switch:** n/a (spike only).

