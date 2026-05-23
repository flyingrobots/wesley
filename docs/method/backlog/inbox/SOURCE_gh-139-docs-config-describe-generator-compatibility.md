# GH-139 docs(config): describe generator compatibility

- Imported from: GitHub issue
- Issue: #139
- URL: https://github.com/flyingrobots/wesley/issues/139
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:43:48Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `docs`, `group:manifest-logic`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Align with config validation issue #138 to keep docs accurate.

# [DOCS-139] docs(config): describe generator compatibility

## Overview

Update configuration documentation to include a compatibility matrix showing which generator targets can be combined and which are mutually exclusive.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #138 (config validation)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: current docs/config sections

## User Story

As a **team configuring Wesley**, I want **clear documentation of generator compatibility**, so that **I can choose targets without trial and error**.

## Acceptance Criteria

- [ ] Docs include compatibility matrix highlighting allowed combinations and exclusivity.
- [ ] Cross-references to config validation behaviours (#138).
- [ ] Examples updated to mention compatible targets.

## Definition of Done

Docs merged with matrix, cross-links added, and optional lint/build passes.

## Scope

### In-Scope

- docs/config guides, README references

### Out-of-Scope

- Implementation of validation (handled in #138)

### Deliverables

- **Est. Lines of Code:** 100-150 (markdown updates)
- **Est. Blast Radius:** docs/config, README

## Implementation Details

### High-Level Approach

Add table summarizing compatibility, update narrative sections, link to validation logs.

### Affected Areas

- docs/config/\*.md
- README config section

### Implementation Steps

- [ ] Draft compatibility matrix.
- [ ] Update docs with matrix and explanations.
- [ ] Cross-link to validation issue/behaviour.

## Test Plan

### Happy Path

- [ ] Docs build/preview passes.

### Edge Cases

- [ ] Ensure matrix stays readable on mobile.

### Failure Cases

- [ ] None (docs only).

### Monitoring & Success Metrics

- [ ] n/a

### QA Sign-off Matrix

| Environment  | Surface | Owner | Status  | Notes |
| ------------ | ------- | ----- | ------- | ----- |
| Docs preview | Site    | TBD   | pending |       |

## Requirements

### Hard Requirements

- Reflect actual validation logic.

### Soft Requirements

- Provide guidance for future targets.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Config maintainers review accuracy.

---

## Production Notes

### Priority: 3 / 5

Improves UX for configuration.

### Complexity: 2 / 5

Documentation update.

### Estimate: 8 - 12 hours

Includes drafting matrix and preview.

### Risk & Rollback

- **Primary Risks:** Docs drift if validation changes.
- **Mitigations:** Note source of truth; link to config schema.
- **Rollback / Kill Switch:** Update matrix when validation changes.
