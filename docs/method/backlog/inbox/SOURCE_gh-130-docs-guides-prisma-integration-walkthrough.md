# GH-130 docs(guides): Prisma integration walkthrough

- Imported from: GitHub issue
- Issue: #130
- URL: https://github.com/flyingrobots/wesley/issues/130
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:23Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `docs`, `group:future-generators`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Align content with generator issue #115 outputs.

# [DOCS-130] docs(guides): Prisma integration walkthrough

## Overview

Write a guide covering how to consume Wesley-generated Prisma artifacts, from config through running `prisma generate` and using the client.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #115 (Prisma generator)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Prisma docs, sample project

## User Story

As a **Prisma user**, I want **a clear integration guide**, so that **I can adopt Wesley without guesswork**.

## Acceptance Criteria

- [ ] Guide created (e.g., `docs/guides/prisma-integration.md`) covering config, CLI steps, sample Prisma usage, and troubleshooting.
- [ ] Linked from README + docs index.
- [ ] Example project or snippet updated to reference the guide.

## Definition of Done

Guide merged, cross-links added, optional snippet validated.

## Scope

### In-Scope

- Documentation and sample snippets

### Out-of-Scope

- Generator implementation (#115)

### Deliverables

- **Est. Lines of Code:** 200-300 (markdown + code snippets)
- **Est. Blast Radius:** docs/guides/, README, example project

## Implementation Details

### High-Level Approach

Document manifest setup, CLI commands, running `prisma generate`, integrating client in app, include troubleshooting (migrations vs schema, env setup).

### Affected Areas

- docs/guides/
- README docs navigation
- Possibly example repo

### Implementation Steps

- [ ] Draft guide outline and content.
- [ ] Add code snippets or update example.
- [ ] Validate snippets (optional tsc).
- [ ] Update nav/README links.

## Test Plan

### Happy Path

- [ ] Docs build preview.

### Edge Cases

- [ ] Ensure guidance covers env configuration.

### Failure Cases

- [ ] Document fallback if user wants to manage Prisma schema manually.

### Monitoring & Success Metrics

- [ ] Optional analytics later.

### QA Sign-off Matrix

| Environment  | Surface | Owner | Status  | Notes |
| ------------ | ------- | ----- | ------- | ----- |
| Docs preview | Web     | TBD   | pending |       |

## Requirements

### Hard Requirements

- Align with generator output and CLI steps.

### Soft Requirements

- Provide tips for customizing Prisma schema.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Generator maintainers review for accuracy.

---

## Production Notes

### Priority: 3 / 5

Essential companion to Prisma generator.

### Complexity: 2 / 5

Docs work.

### Estimate: 12 - 16 hours

Includes drafting, review, snippet validation.

### Risk & Rollback

- **Primary Risks:** Docs drift if generator changes.
- **Mitigations:** Reference generator version, plan periodic review.
- **Rollback / Kill Switch:** Update guide when generator evolves.
