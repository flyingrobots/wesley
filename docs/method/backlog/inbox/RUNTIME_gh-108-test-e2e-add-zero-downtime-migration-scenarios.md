# GH-108 test(e2e): add zero-downtime migration scenarios

- Imported from: GitHub issue
- Issue: #108
- URL: https://github.com/flyingrobots/wesley/issues/108
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:56Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `enhancement`, `ci`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Leverage docker harness (#122) and workload replay (#124) for scenarios.

# [TEST-108] test(e2e): add zero-downtime migration scenarios

## Overview

Implement the E2E tests defined in docs/specs/zero-downtime-migration-e2e.md to validate phased migrations under load.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #122, #124
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: zero-downtime-migration-e2e spec

## User Story

As a **maintainer**, I want **E2E migration scenarios**, so that **I can ensure phased migrations behave under load**.

## Acceptance Criteria

- [ ] Scenarios T1–T7 implemented (nullable column, NOT NULL backfill, FK validation, large backfill, concurrent traffic, failing default, rehearse retry).
- [ ] Lock timelines and phase durations captured; JSON summaries persisted.
- [ ] Background workload helpers added for concurrency tests.
- [ ] CI workflow `migrations-e2e.yml` runs nightly + via PR label, publishing artifacts.
- [ ] Docs updated with instructions to run scenarios locally.

## Definition of Done

E2E suite running in CI, artifacts published, docs updated, spec satisfied.

## Scope

### In-Scope

- Scenario implementation
- Workload helpers
- CI workflow
- Documentation

### Out-of-Scope

- Changes to migration planner (covered elsewhere)

### Deliverables

- **Est. Lines of Code:** 900-1200
- **Est. Blast Radius:** tests/e2e, scripts, CI workflows, docs

## Implementation Details

### High-Level Approach

Use docker compose harness to run scenarios, script each T1–T7 case, capture metrics, integrate with CI, document usage.

### Affected Areas

- tests/e2e/migrations
- scripts/workload helpers
- .github/workflows/migrations-e2e.yml
- docs/specs update

### Implementation Steps

- [ ] Implement scenarios per spec.
- [ ] Add workload helpers + metric capture.
- [ ] Configure CI workflow with nightly + PR label triggers.
- [ ] Update docs with local instructions.

## Test Plan

### Happy Path

- [ ] All scenarios pass locally and in CI, artifacts uploaded.

### Edge Cases

- [ ] Ensure CI handles longer-running scenarios (timeouts tuned).

### Failure Cases

- [ ] CI fails when blocking locks/data regressions detected.

### Monitoring & Success Metrics

- [ ] Track CI runtime/failure rate.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| CI | migrations-e2e workflow | TBD | pending | |

## Requirements

### Hard Requirements

- Scenarios aligned with spec; metrics recorded.

### Soft Requirements

- Provide optional flags to run individual scenarios.

### Runtime Requirements

- Ensure docker resources cleaned after run.

### Dependencies & Approvals

- [ ] Infra approval for CI runtime.

---

## Production Notes

### Priority: 4 / 5

Validates zero-downtime promises.

### Complexity: 5 / 5

Comprehensive E2E suite + CI.

### Estimate: 160 - 200 hours

Includes scenario implementation, helpers, CI, docs.

### Risk & Rollback

- **Primary Risks:** Flaky tests prolonging CI.
- **Mitigations:** Tune workloads, allow reruns.
- **Rollback / Kill Switch:** Gate workflow behind manual trigger if unstable.
