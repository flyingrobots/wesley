# GH-179 chore(core): design audit for SRP, god-class patterns, and opts anti-pattern

- Imported from: GitHub issue
- Issue: #179
- URL: https://github.com/flyingrobots/wesley/issues/179
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:00Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `chore`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: manual override: core architecture audit belongs with source semantics and core design boundaries.

## Original Issue

---

## Additional Notes

Share audit findings in the RFC repo or docs to inform future contributors.

# [CORE-179] chore(core): design audit for SRP, god-class patterns, and opts anti-pattern

## Overview

Perform an architectural audit of `@wesley/core` to identify remaining single-responsibility violations, god classes, and `opts = {}` anti-pattern usage, documenting findings and proposing refactors.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #180 (JSDoc audit), #178 (test audit)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md

## User Story

As a **core maintainer**, I want **a clear assessment of SRP violations and anti-patterns**, so that **I can plan targeted refactors to keep the codebase healthy**.

## Acceptance Criteria

- [ ] Inventory of modules violating SRP or exhibiting god-class behaviour.
- [ ] Recommendations for refactors (split modules, reorganize responsibilities).
- [ ] Identify and catalog instances of `opts = {}` anti-pattern with suggested fixes.
- [ ] Document findings and open follow-up tasks/issues as needed.

## Definition of Done

Audit report produced (markdown doc or issue comment), follow-up tickets created, and findings shared with team.

## Scope

### In-Scope

- Codebase review and documentation of findings.

### Out-of-Scope

- Implementing the refactors (tracked separately).

### Deliverables

- **Est. Lines of Code:** <100 (mostly docs)
- **Est. Blast Radius:** Documentation + new follow-up issues

## Implementation Details

### High-Level Approach

Review core directories, note modules/classes violating SRP or using `opts` anti-pattern, prioritize severity, and document recommendations in a report.

### Affected Areas

- packages/wesley-core/*
- docs/architecture notes (optional)

### Implementation Steps

- [ ] Conduct code review pass focused on SRP/god-class issues.
- [ ] Catalog all `opts = {}` patterns and evaluate necessity.
- [ ] Draft audit report with prioritized recommendations.
- [ ] File follow-up issues for significant refactors.

## Test Plan

### Happy Path

- [ ] Audit report reviewed by core maintainers.

### Edge Cases

- [ ] Consider modules intentionally complex; document rationale.

### Failure Cases

- [ ] n/a (audit deliverable).

### Monitoring & Success Metrics

- [ ] Track completion of follow-up issues in future milestones.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| n/a | Documentation | n/a | n/a | |

## Requirements

### Hard Requirements

- Provide actionable recommendations, not just observations.

### Soft Requirements

- Include severity/priority labels for findings.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Core maintainers review audit summary.

---

## Production Notes

### Priority: 3 / 5

Important for maintainability.

### Complexity: 2 / 5

Primarily research/audit.

### Estimate: 24 - 32 hours

Includes review, documentation, follow-up issue creation.

### Risk & Rollback

- **Primary Risks:** None (audit). Ensure findings communicated clearly.
- **Mitigations:** Share report with team; convert to actionable tickets.
- **Rollback / Kill Switch:** n/a.
