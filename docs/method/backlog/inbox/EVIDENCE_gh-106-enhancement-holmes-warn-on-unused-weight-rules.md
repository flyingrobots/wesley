# GH-106 enhancement(holmes): warn on unused weight rules

- Imported from: GitHub issue
- Issue: #106
- URL: https://github.com/flyingrobots/wesley/issues/106
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:45Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `enhancement`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

---

## Additional Notes

Follow-up from review feedback on #102.

# [HOLMES-106] enhancement(holmes): warn on unused weight rules

## Overview

Enhance the HOLMES weight loader to warn (optionally fail) when rules in the weight config never match any UID, catching typos and drift.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #102
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Current weights loader

## User Story

As a **HOLMES user**, I want **visibility into unused weight rules**, so that **I catch typos or stale overrides early**.

## Acceptance Criteria

- [ ] Loader tracks which overrides/directives/substrings applied during investigation.
- [ ] Warnings emitted (and/or reported) for unused patterns.
- [ ] Optional strict mode fails on unused entries.
- [ ] Tests verify warnings appear for unused entries.

## Definition of Done

Weight loader updated, warnings/strict mode available, tests passing, documentation updated.

## Scope

### In-Scope

- Weight loader enhancements
- Warning/reporting mechanism
- Optional strict mode
- Tests/docs

### Out-of-Scope

- Changes to weight configuration format

### Deliverables

- **Est. Lines of Code:** 150-250
- **Est. Blast Radius:** HOLMES weight loader, reports, docs

## Implementation Details

### High-Level Approach

Track matched rules during investigation, collect unused entries, emit warnings or fail in strict mode, update docs.

### Affected Areas

- packages/wesley-holmes weights loader
- Report generation/logging
- Docs (weights guide)

### Implementation Steps

- [ ] Instrument loader to track matches.
- [ ] Emit warnings/report entries.
- [ ] Add strict mode flag.
- [ ] Update tests and docs.

## Test Plan

### Happy Path

- [ ] Config with all rules matching -> no warnings.

### Edge Cases

- [ ] Unused rule triggers warning/strict failure.

### Failure Cases

- [ ] Strict mode fails when unused entries found.

### Monitoring & Success Metrics

- [ ] Optional future telemetry.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Weight loader | TBD | pending | |

## Requirements

### Hard Requirements

- Backwards compatible default (warnings only).

### Soft Requirements

- Provide CLI flag or config toggle for strict mode.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] HOLMES maintainers review design.

---

## Production Notes

### Priority: 3 / 5

Improves configuration hygiene.

### Complexity: 3 / 5

Moderate loader enhancement.

### Estimate: 24 - 32 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** False positives causing noise.
- **Mitigations:** Provide strict mode opt-in, clear messaging.
- **Rollback / Kill Switch:** Disable warnings if necessary.
