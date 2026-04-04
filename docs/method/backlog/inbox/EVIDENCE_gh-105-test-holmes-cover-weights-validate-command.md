# GH-105 test(holmes): cover weights validate command

- Imported from: GitHub issue
- Issue: #105
- URL: https://github.com/flyingrobots/wesley/issues/105
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:43Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: `tests`, `holmes`

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

---

## Additional Notes

Ensure tests aligned with behaviour from #102.

# [HOLMES-105] test(holmes): cover weights validate command

## Overview

Add end-to-end tests for `holmes weights:validate` CLI to verify exit codes and JSON output.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #102
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Existing HOLMES CLI tests

## User Story

As a **maintainer**, I want **tests for the weights validation command**, so that **CLI behaviour stays correct**.

## Acceptance Criteria

- [ ] Tests cover success, failure (missing file), and `--json` output.
- [ ] Failures exit non-zero with helpful messaging.
- [ ] New tests run in CI.

## Definition of Done

Tests merged, CI passing, coverage documented.

## Scope

### In-Scope

- Node/Bats tests
- Test fixtures (weights.json)

### Out-of-Scope

- CLI feature changes

### Deliverables

- **Est. Lines of Code:** 100-150
- **Est. Blast Radius:** HOLMES tests, package scripts

## Implementation Details

### High-Level Approach

Add fixtures/tmp dirs, write tests for CLI command covering success/failure/JSON, integrate into CI.

### Affected Areas

- packages/wesley-holmes tests
- CI configuration (if needed)

### Implementation Steps

- [ ] Create fixture(s) or temp dir usage.
- [ ] Write tests covering scenarios.
- [ ] Ensure tests run via existing test command.

## Test Plan

### Happy Path

- [ ] `holmes weights:validate` passes with valid file.

### Edge Cases

- [ ] Missing file -> failure.
- [ ] JSON output path validated.

### Failure Cases

- [ ] Non-zero exits for failure cases.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| CI | HOLMES tests | TBD | pending | |

## Requirements

### Hard Requirements

- Tests must run as part of existing HOLMES test command.

### Soft Requirements

- Minimal dependencies; use tmp dirs for isolation.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] HOLMES maintainers review tests.

---

## Production Notes

### Priority: 3 / 5

Improves CLI test coverage.

### Complexity: 2 / 5

Small test addition.

### Estimate: 8 - 12 hours

Includes writing tests and verifying CI.

### Risk & Rollback

- **Primary Risks:** Flaky tests due to temp files.
- **Mitigations:** Use tmp libs; clean up.
- **Rollback / Kill Switch:** Revert test addition if issues appear.
