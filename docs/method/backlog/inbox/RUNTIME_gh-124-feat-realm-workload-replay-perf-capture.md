# GH-124 feat(realm): workload replay + perf capture

- Imported from: GitHub issue
- Issue: #124
- URL: https://github.com/flyingrobots/wesley/issues/124
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:02Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `group:shadow-realm`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Coordinate with REALM harness (#122) and HOLMES evidence pipeline (#184).

# [REALM-124] feat(realm): workload replay + perf capture

## Overview

Add tooling to replay recorded workload traces against Shadow REALM and capture lock/performance metrics for HOLMES/REALM evidence.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #122 (REALM harness), #184 (schema hash/HOLMES)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing REALM scripts, HOLMES bundle schema

## User Story

As a **database operator**, I want **workload replay in Shadow REALM**, so that **I can validate lock/perf characteristics during rehearsals**.

## Acceptance Criteria

- [ ] Define trace format (SQL + params + expected results) and provide sample traces for demo schema.
- [ ] Implement replay runner invoked via `wesley shadow run --workload traces/`.
- [ ] Collect metrics (latency, lock waits, row counts) and merge into `.wesley/realm.json` + HOLMES evidence.
- [ ] Docs updated with instructions for capturing/replaying traces.

## Definition of Done

Workload replay integrated, evidence enriched, docs updated, tests covering sample traces.

## Scope

### In-Scope

- Trace format design
- Replay runner implementation
- Metrics collection + evidence integration
- Docs/tests

### Out-of-Scope

- Production trace capture tooling (document manual process)

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** REALM harness scripts, HOLMES bundle, docs

## Implementation Details

### High-Level Approach

Define JSON/SQL trace format, build replay runner executing traces against shadow DB, collect metrics, integrate output into REALM/HOLMES bundles, document usage.

### Affected Areas

- packages/wesley-shadow (new/expanded)
- HOLMES evidence pipeline
- Docs (REALM guide)

### Implementation Steps

- [ ] Specify trace format and sample traces.
- [ ] Implement runner with metrics collection.
- [ ] Integrate metrics into evidence bundle.
- [ ] Update docs and add tests.

## Test Plan

### Happy Path

- [ ] Sample trace replay executes successfully with metrics recorded.

### Edge Cases

- [ ] Handle errors (failures recorded without crashing).
- [ ] Large trace sets; ensure performance acceptable.

### Failure Cases

- [ ] Invalid trace file triggers clear error.

### Monitoring & Success Metrics

- [ ] HOLMES reports display workload metrics (validate).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/integration | Replay runner | TBD | pending | |

## Requirements

### Hard Requirements

- Metrics integrated into REALM/HOLMES bundles.

### Soft Requirements

- Provide scripts for capturing traces (manual instructions acceptable).

### Runtime Requirements

- Replay runner must respect transaction ordering.

### Dependencies & Approvals

- [ ] Coordination with HOLMES maintainers.

---

## Production Notes

### Priority: 4 / 5

Delivers promised rehearsal insights.

### Complexity: 5 / 5

Trace format + runner + evidence integration.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Replay divergence, metrics overhead.
- **Mitigations:** Start with limited scope; allow opt-out.
- **Rollback / Kill Switch:** Disable workload replay if issues arise.
