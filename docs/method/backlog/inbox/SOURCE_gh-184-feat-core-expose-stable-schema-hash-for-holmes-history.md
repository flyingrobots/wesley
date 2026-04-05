# GH-184 feat(core): expose stable schema hash for HOLMES history

- Imported from: GitHub issue
- Issue: #184
- URL: https://github.com/flyingrobots/wesley/issues/184
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T16:06:02Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `feature`, `holmes`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: manual override: stable schema hash is a source-identity contract before it feeds Holmes history.

## Original Issue

---

## Additional Notes

Ensure hashing strategy aligns with existing IR schema to avoid cross-version drift.

# [CORE-184] feat(core): expose stable schema hash for HOLMES history

## Overview

Compute and expose a deterministic schema hash (e.g., SHA-256 of normalized schema JSON) so HOLMES can track history by schema state.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #195, #194 (docs linking), #193 (dashboard guide)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md, HOLMES bundle format

## User Story

As a **HOLMES consumer**, I want **a stable schema hash emitted with bundles**, so that **history tracking and comparisons remain accurate across runs**.

## Acceptance Criteria

- [ ] Deterministic hash generated after schema normalization.
- [ ] Hash included in evidence bundles (scores.json, bundle metadata) and CLI output.
- [ ] HOLMES tools updated to consume hash for history (if part of this issue or follow-up).
- [ ] Tests verifying hash stability and change detection.

## Definition of Done

Hash generation merged, evidence bundle schema updated, tests passing, and documentation reflecting new field.

## Scope

### In-Scope

- Hash computation in core
- Evidence bundle updates
- CLI output adjustments

### Out-of-Scope

- Extensive HOLMES UI updates (handled separately)

### Deliverables

- **Est. Lines of Code:** 150-250
- **Est. Blast Radius:** `packages/wesley-core`, evidence bundle schema, HOLMES integration

## Implementation Details

### High-Level Approach

Normalize schema representation (sorted JSON), hash via SHA-256, insert into bundle metadata, and expose via CLI to HOLMES.

### Affected Areas

- packages/wesley-core (schema normalization)
- `.wesley/evidence-map.json`, `scores.json`
- HOLMES ingest logic

### Implementation Steps

- [ ] Implement normalization + hashing utility.
- [ ] Integrate hash into generate pipeline and evidence bundle writer.
- [ ] Update HOLMES tooling to read new field.
- [ ] Write tests ensuring hash changes when schema changes.

## Test Plan

### Happy Path

- [ ] Same schema yields identical hash across runs.

### Edge Cases

- [ ] Schema with different directive ordering still produces same hash.

### Failure Cases

- [ ] Modify schema -> hash change detected.

### Monitoring & Success Metrics

- [ ] HOLMES history keyed by hash (observed in logs/outputs).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Hash utility | TBD | pending | |
| Integration | HOLMES ingest | TBD | pending | |

## Requirements

### Hard Requirements

- Hash must be stable regardless of non-semantic ordering.

### Soft Requirements

- Document hash algorithm/version for future compatibility.

### Runtime Requirements

- Minimal performance overhead.

### Dependencies & Approvals

- [ ] HOLMES maintainers review new field usage.

---

## Production Notes

### Priority: 4 / 5

Supports HOLMES evidence reliability.

### Complexity: 2 / 5

Focused change with moderate integration.

### Estimate: 24 - 32 hours

Includes implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Hash drift due to normalization bugs.
- **Mitigations:** Comprehensive tests, log hash in CLI for visibility.
- **Rollback / Kill Switch:** Revert hash addition if unforeseen issues arise.
