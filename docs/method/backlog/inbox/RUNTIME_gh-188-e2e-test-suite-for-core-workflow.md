# GH-188 E2E Test Suite for Core Workflow

- Imported from: GitHub issue
- Issue: #188
- URL: https://github.com/flyingrobots/wesley/issues/188
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:21Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: _none_

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Coordinate with infra to provision test database images as part of CI.

# [QA-188] E2E Test Suite for Core Workflow

## Overview

Build an automated end-to-end suite that exercises the complete Wesley pipeline (transform → plan → rehearse → certify) against a real database, ensuring regressions are caught before release.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #189, #190 rely on robust tests
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing fixtures in `test/fixtures/`

## User Story

As a **maintainer**, I want **a reliable E2E test suite covering the full workflow**, so that **I can confidently ship features like destructive migrations without breaking core flows**.

## Acceptance Criteria

- [ ] CI job spins up Postgres (or appropriate DB) and runs transform → plan → rehearse → certify on reference schemas.
- [ ] Includes assertions on generated artifacts, plan outputs, rehearsal verdicts, and SHIPME verification.
- [ ] Test suite runs with acceptable duration (<10 min) and documented setup.
- [ ] Failures provide actionable logs/artifacts for debugging.

## Definition of Done

E2E suite running in CI on main branch, documented in CONTRIBUTING, and adopted by maintainers as part of pre-merge checks.

## Scope

### In-Scope

- Test orchestration scripts
- Docker/Postgres harness or Testcontainers
- CI integration

### Out-of-Scope

- Support for multiple databases (future enhancement)

### Deliverables

- **Est. Lines of Code:** 600-800 (tests + harness)
- **Est. Blast Radius:** `test/e2e/`, `.github/workflows/`

## Implementation Details

### High-Level Approach

Reuse existing fixtures, create e2e runner that executes CLI commands sequentially, capture outputs, and validate results (e.g., compare against expected artifacts). Integrate into GitHub Actions with caching for performance.

### Affected Areas

- New e2e test directory
- CI workflow definitions
- Possibly updates to CLI to support test hooks

### Implementation Steps

- [ ] Design test matrix and select fixtures.
- [ ] Implement test runner (Node or shell) invoking CLI steps.
- [ ] Capture artifacts and compare using assertions.
- [ ] Integrate with CI workflow, ensure deterministic environment.
- [ ] Document how to run locally.

## Test Plan

### Happy Path

- [ ] Default fixture passes full pipeline.

### Edge Cases

- [ ] Additional fixture with complex schema (tenancy/RLS).
- [ ] Simulate failure and ensure suite surfaces errors clearly.

### Failure Cases

- [ ] Intentionally break CLI command to confirm failures fail fast.

### Monitoring & Success Metrics

- [ ] Track runtime and flake rate over time (set alert if >5% failures).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| GitHub Actions | E2E workflow | TBD | pending | |
| Local Docker | Developer machine | TBD | pending | |

## Requirements

### Hard Requirements

- Tests must run headless in CI with minimal setup.
- Provide cleanup logic to leave DB clean.

### Soft Requirements

- Support running subset locally via npm script.

### Runtime Requirements

- Works with Postgres 14+ (align with production target).

### Dependencies & Approvals

- [ ] Infra approval for additional CI runtime
- [ ] Agreement on fixture selection from core team

---

## Production Notes

### Priority: 5 / 5

Highest priority gap for safety.

### Complexity: 4 / 5

Cross-cutting tests + CI integration.

### Estimate: 80 - 120 hours

Includes harness, CI, and stabilization.

### Risk & Rollback

- **Primary Risks:** Flaky tests impacting CI.
- **Mitigations:** Start with minimal cases, invest in stability, allow manual rerun.
- **Rollback / Kill Switch:** Ability to disable job temporarily while fixing flakes.
