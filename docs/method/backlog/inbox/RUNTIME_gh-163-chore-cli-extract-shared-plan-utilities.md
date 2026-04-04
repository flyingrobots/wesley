# GH-163 chore(cli): extract shared plan utilities

- Imported from: GitHub issue
- Issue: #163
- URL: https://github.com/flyingrobots/wesley/issues/163
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:04Z
- Lane: `inbox`
- Legend: `RUNTIME`
- Labels: `chore`, `pkg:wesley-cli`

## Legend Fit

This issue primarily changes execution lifecycle, hosts, operator flows, local tooling, CI, or other runtime surfaces.

Trigger: default: runtime, host, operator-flow, CI, or repo execution surface.

## Original Issue

---

## Additional Notes

Add unit tests for the shared utilities once extracted.

# [CLI-163] chore(cli): extract shared plan utilities

## Overview

Deduplicate overlapping helpers between `plan.mjs` and `rehearse.mjs` by moving them into a shared module so CLI behaviour remains consistent.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #189 (destructive planner)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: TASKLIST entry in packages/wesley-cli

## User Story

As a **CLI maintainer**, I want **plan and rehearse commands to share utilities**, so that **behaviour stays consistent and maintenance easier**.

## Acceptance Criteria

- [ ] Shared helpers extracted into reusable module.
- [ ] Plan and rehearse commands consume shared module.
- [ ] Unit tests cover shared logic.
- [ ] Documentation/changelog updated as needed.

## Definition of Done

Refactor merged, tests passing, duplicate code removed.

## Scope

### In-Scope

- Refactoring plan/rehearse helpers
- Adding tests

### Out-of-Scope

- New CLI features

### Deliverables

- **Est. Lines of Code:** 150-250
- **Est. Blast Radius:** plan/rehearse commands, new module

## Implementation Details

### High-Level Approach

Identify duplicated functions, extract into `utils/plan-shared.mjs` (or similar), update imports, add tests verifying shared logic.

### Affected Areas

- packages/wesley-cli/src/commands/plan.mjs
- packages/wesley-cli/src/commands/rehearse.mjs
- New utils module + tests

### Implementation Steps

- [ ] Catalog duplicated helpers.
- [ ] Create shared module.
- [ ] Refactor commands to use module.
- [ ] Add unit tests and update docs.

## Test Plan

### Happy Path

- [ ] plan & rehearse commands still function via unit/e2e tests.

### Edge Cases

- [ ] Ensure shared helpers handle all existing options.

### Failure Cases

- [ ] Tests fail if shared helper changes behaviour unexpectedly.

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit/e2e tests | CLI | TBD | pending | |

## Requirements

### Hard Requirements

- No behavioural regressions.

### Soft Requirements

- Document shared utility usage for future contributors.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] CLI maintainers review refactor.

---

## Production Notes

### Priority: 3 / 5

Improves maintainability.

### Complexity: 2 / 5

Contained refactor.

### Estimate: 16 - 24 hours

Includes refactor + tests.

### Risk & Rollback

- **Primary Risks:** Regression in CLI options handling.
- **Mitigations:** Add tests, manual smoke run.
- **Rollback / Kill Switch:** Revert refactor if issues appear.
