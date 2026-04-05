# GH-162 docs: align examples with canonical @wes_* directives

- Imported from: GitHub issue
- Issue: #162
- URL: https://github.com/flyingrobots/wesley/issues/162
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:42:16Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `documentation`, `docs`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Capture a checklist of files updated to avoid regressions.

# [DOCS-162] docs: align examples with canonical @wes_* directives

## Overview

Sweep READMEs, docs, and example schemas to consistently use canonical `@wes_*` directives and document any aliases to prevent future drift.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: none
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: docs/DIRECTIVES.md, example schemas

## User Story

As a **user reading Wesley docs**, I want **consistent directive names**, so that **I don’t get confused by legacy aliases**.

## Acceptance Criteria

- [ ] All primary docs and example schemas use `@wes_*` directives by default.
- [ ] Any alias usage explicitly documented (e.g., migration guides).
- [ ] Lint or CI check added (optional) to guard future drift.

## Definition of Done

Documentation updated, examples aligned, optional lint check in place or follow-up filed.

## Scope

### In-Scope

- README files, docs, example schemas

### Out-of-Scope

- Code changes beyond docs/examples (unless necessary)

### Deliverables

- **Est. Lines of Code:** 200-300 (docs/schema edits)
- **Est. Blast Radius:** docs/, README, test fixtures

## Implementation Details

### High-Level Approach

Search/replace legacy directives, verify examples render, update docs describing canonical forms, optionally add lint script.

### Affected Areas

- docs/README.md and related docs
- Example schemas under docs/test fixtures

### Implementation Steps

- [ ] Audit files for legacy directives.
- [ ] Update to `@wes_*` forms.
- [ ] Document alias usage where necessary.
- [ ] Run docs/site build to verify.

## Test Plan

### Happy Path

- [ ] Docs build without errors.

### Edge Cases

- [ ] Ensure code blocks intentionally demonstrating aliases remain correct.

### Failure Cases

- [ ] Broken references after replacements.

### Monitoring & Success Metrics

- [ ] Optional lint check to prevent regressions.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Docs preview | Site | TBD | pending | |

## Requirements

### Hard Requirements

- Canonical directives referenced everywhere.

### Soft Requirements

- Provide note explaining aliases deprecated timeline.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Docs maintainers review changes.

---

## Production Notes

### Priority: 3 / 5

Improves docs clarity.

### Complexity: 2 / 5

Mostly doc sweeps.

### Estimate: 16 - 24 hours

Includes search/replace, verification, docs build.

### Risk & Rollback

- **Primary Risks:** Unintentional replacement of examples showing legacy behaviour.
- **Mitigations:** Review diff carefully, retain intentional examples.
- **Rollback / Kill Switch:** Revert doc changes if issues arise.
