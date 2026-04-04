# GH-178 test(core): audit legacy mocks and brittle stdout assertions

- Imported from: GitHub issue
- Issue: #178
- URL: https://github.com/flyingrobots/wesley/issues/178
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:20Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`, `tests`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Consider documenting new testing guidelines in CONTRIBUTING.

# [TEST-178] test(core): audit legacy mocks and brittle stdout assertions

## Overview

Audit the core test suite to identify mock-heavy tests and fragile stdout/stderr assertions, modernizing them with more resilient patterns.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #177 (AST-based SQL comparison), #179 (design audit)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md

## User Story

As a **maintainer**, I want **core tests to rely on stable patterns**, so that **refactors don't break tests that rely on mocks or log sniffing**.

## Acceptance Criteria

- [ ] Inventory tests using heavy mocks or stdout assertions.
- [ ] Replace with focused unit/property tests or integration tests where appropriate.
- [ ] Remove redundant tests duplicating integration coverage.
- [ ] Document any remaining intentional uses of mocks/log checks.

## Definition of Done

Test suite updated, mock usage reduced, fragile assertions removed, and documentation added if needed.

## Scope

### In-Scope

- Core test files under `packages/wesley-core`

### Out-of-Scope

- CLI/test suites outside core (follow-up)

### Deliverables

- **Est. Lines of Code:** 300-400 (test rewrites)
- **Est. Blast Radius:** test files, potential helpers

## Implementation Details

### High-Level Approach

Review tests, refactor to use direct function calls or property tests, replace stdout assertions with API-level checks, and remove legacy mocks.

### Affected Areas

- packages/wesley-core/tests
- Test utilities/helpers

### Implementation Steps

- [ ] Audit tests and categorize issues.
- [ ] Refactor or remove problematic tests.
- [ ] Add property tests where beneficial.
- [ ] Update CONTRIBUTING/testing guidelines.

## Test Plan

### Happy Path

- [ ] Updated tests pass locally and in CI.

### Edge Cases

- [ ] Ensure removal of redundant tests doesn't reduce coverage (run coverage report).

### Failure Cases

- [ ] Identify tests that cannot be easily refactored and document rationale.

### Monitoring & Success Metrics

- [ ] Track coverage, guard against significant drops.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| CI | Core tests | TBD | pending | |

## Requirements

### Hard Requirements

- Maintain or improve coverage.

### Soft Requirements

- Capture lessons learned in documentation.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Core testing maintainers review changes.

---

## Production Notes

### Priority: 3 / 5

Improves stability of test suite.

### Complexity: 3 / 5

Moderate refactor effort.

### Estimate: 40 - 60 hours

Includes audit, refactor, documentation.

### Risk & Rollback

- **Primary Risks:** Removing tests accidentally reduces coverage.
- **Mitigations:** Use coverage tools and peer review.
- **Rollback / Kill Switch:** Reintroduce removed tests if gaps identified.
