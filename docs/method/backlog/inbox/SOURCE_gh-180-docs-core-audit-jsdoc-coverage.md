# GH-180 docs(core): audit JSDoc coverage

- Imported from: GitHub issue
- Issue: #180
- URL: https://github.com/flyingrobots/wesley/issues/180
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:01Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `documentation`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Coordinate with tooling to run JSDoc lint checks once updated.

# [DOCS-180] docs(core): audit JSDoc coverage

## Overview

Audit `@wesley/core` modules for missing or outdated JSDoc annotations and update them to reflect the current API surface.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #179 (design audit) for context
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md

## User Story

As a **maintainer**, I want **accurate JSDoc coverage in core modules**, so that **type information and tooling stay correct**.

## Acceptance Criteria

- [ ] Public exports documented with accurate JSDoc signatures and parameter descriptions.
- [ ] Outdated or misleading comments removed.
- [ ] Internal modules clearly marked or deliberately undocumented.
- [ ] Optional: run documentation lint or generate typedoc preview to ensure no errors.

## Definition of Done

Audit complete, documentation updated, optional lint passes, and TASKLIST item checked off.

## Scope

### In-Scope

- JSDoc updates across `packages/wesley-core`
- Removing stale comments

### Out-of-Scope

- Functional code changes

### Deliverables

- **Est. Lines of Code:** 150-250 (comments)
- **Est. Blast Radius:** `packages/wesley-core`

## Implementation Details

### High-Level Approach

Review modules, update or add JSDoc blocks, note any internal APIs to exclude, optionally add lint step in CI to enforce coverage.

### Affected Areas

- Core modules (parser, generators, utils)
- Potential CI lint configuration

### Implementation Steps

- [ ] Inventory modules lacking JSDoc.
- [ ] Update/add JSDoc comments.
- [ ] Remove outdated/stale comments.
- [ ] Run lint/typedoc (if applicable) and update docs.

## Test Plan

### Happy Path

- [ ] Run JSDoc/typedoc or lint to confirm no syntax issues.

### Edge Cases

- [ ] Document generics/complex types accurately.

### Failure Cases

- [ ] None (documentation only); ensure lint fails if errors introduced.

### Monitoring & Success Metrics

- [ ] Potential future: track typedoc generation success.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| n/a | Comments | n/a | n/a | Documentation task |

## Requirements

### Hard Requirements

- Align docs with exported API.

### Soft Requirements

- Optionally add guidelines to CONTRIBUTING.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Core maintainers review doc updates.

---

## Production Notes

### Priority: 3 / 5

Improves maintainability.

### Complexity: 2 / 5

Documentation review.

### Estimate: 24 - 32 hours

Includes audit and updates.

### Risk & Rollback

- **Primary Risks:** None; ensure no incorrect docs introduced.
- **Mitigations:** Peer review.
- **Rollback / Kill Switch:** Revert comment changes if needed.
