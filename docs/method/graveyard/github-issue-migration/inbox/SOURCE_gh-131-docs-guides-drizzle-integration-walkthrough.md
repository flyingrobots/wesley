# GH-131 docs(guides): Drizzle integration walkthrough

- Imported from: GitHub issue
- Issue: #131
- URL: https://github.com/flyingrobots/wesley/issues/131
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:24Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `docs`, `group:future-generators`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Coordinate with generator issue #120 to ensure output stable before documenting.

# [DOCS-131] docs(guides): Drizzle integration walkthrough

## Overview

Write a guide showing how to consume Wesley-generated Drizzle artifacts, covering manifest setup, CLI invocation, and integration in a TypeScript app.

## References & Assets

This template is perfect for documenting implementation tasks!

- [x] Other Assets: Generated Drizzle artifacts, example project snippets

## Acceptance Criteria

- [ ] Guide added (e.g., `docs/guides/drizzle-integration.md`) covering setup, CLI usage, and sample code.
- [ ] Linked from README/docs nav.
- [ ] Snippets validated (manual or automated check) to compile.

## Definition of Done

Guide merged, cross-links added, optional smoke build verifying snippets.

## Scope

### In-Scope

- Documentation content
- Example snippets or repo references

### Out-of-Scope

- Generator changes (handled in #120)

### Deliverables

- **Est. Lines of Code:** 200-300 (markdown + snippets)
- **Est. Blast Radius:** docs/guides/, README navigation

## Implementation Details

### High-Level Approach

Document manifest config, CLI commands, schema output, integration patterns (relations, enums), and optional realtime considerations.

### Affected Areas

- docs/guides/
- README/docs nav
- Optional example repo snippet

### Implementation Steps

- [ ] Draft outline covering setup, usage, best practices.
- [ ] Include code snippets referencing generated artifacts.
- [ ] Validate snippets (tsc or lint) if feasible.
- [ ] Update README/docs navigation.

## Test Plan

### Happy Path

- [ ] Markdown builds/render without errors.

### Edge Cases

- [ ] Ensure snippet syntax highlighting correct.

### Failure Cases

- [ ] Broken links caught via docs build.

### Monitoring & Success Metrics

- [ ] Optional: track doc page views (future).

### QA Sign-off Matrix

| Environment  | Surface | Owner | Status  | Notes |
| ------------ | ------- | ----- | ------- | ----- |
| Docs preview | Web     | TBD   | pending |       |

## Requirements

### Hard Requirements

- Align instructions with generator output.

### Soft Requirements

- Provide tips for customizing Drizzle migrations.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Generator owners review doc for accuracy.

---

## Production Notes

### Priority: 3 / 5

Boosts adoption of Drizzle generator.

### Complexity: 2 / 5

Docs writing + snippet validation.

### Estimate: 12 - 16 hours

Includes drafting, review, validation.

### Risk & Rollback

- **Primary Risks:** Docs drift if generator changes.
- **Mitigations:** Link to generator version; update when output changes.
- **Rollback / Kill Switch:** Update guide as generator evolves.
