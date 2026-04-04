# GH-192 docs(holmes): Adoption Docs Pack (CI/CD + Dashboard + Links)

- Imported from: GitHub issue
- Issue: #192
- URL: https://github.com/flyingrobots/wesley/issues/192
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:08Z
- Lane: `inbox`
- Legend: `EVIDENCE`
- Labels: _none_

## Legend Fit

This issue primarily changes proof, provenance, explainability, certification, security evidence, or Holmes-family judgment.

Trigger: title/label match: evidence, certification, security, or Holmes-family judgment surface.

## Original Issue

---

## Additional Notes

Consolidated on 2025-10-23: this single ticket owns the HOLMES CI/CD guide, dashboard/report guide, and link surfacing work (former #192–#195). Coordinate with Docs + HOLMES maintainers for review.

# [WB-DOCS-192] docs(holmes): Adoption Docs Pack (CI/CD + Dashboard + Link Surfacing)

## Overview

Publish a cohesive set of HOLMES documentation assets so teams can wire HOLMES into CI, understand dashboard/report outputs, and discover the material from primary entry points.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #184 (schema hash), #183 (RLS improvements) for context
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: docs/holmes-dashboard/, packages/wesley-holmes/README.md, docs/README.md

## User Story

As a **DevOps lead adopting HOLMES**, I want **step-by-step guidance and clear navigation**, so that **I can integrate HOLMES into CI/CD, interpret reports, and share docs with my team quickly**.

## Acceptance Criteria

- [ ] New CI/CD integration guide covering workflow setup, artifact uploads, comment gating, secrets, and troubleshooting.
- [ ] HOLMES dashboard/report guide explaining SCS/MRI/TCI, verdicts, and weight customization with annotated visuals.
- [ ] `docs/README.md` highlights the two new guides in the HOLMES section.
- [ ] `packages/wesley-holmes/README.md` links to the new guides under Additional Resources.
- [ ] Docs build/preview passes and reviewers from HOLMES team sign off.

## Deliverable Checklist

1. **CI/CD Guide**
   - [ ] Draft `docs/features/holmes-ci-cd.md` with sample GitHub Actions YAML.
   - [ ] Validate workflow in sandbox repo and incorporate lessons learned.
2. **Dashboard & Reports Guide**
   - [ ] Draft `docs/features/holmes-dashboard.md` (or update existing) with screenshots and report explanations.
   - [ ] Include quick-reference tables for SCS/MRI/TCI and weight tuning steps.
3. **Entry Points & Surfacing**
   - [ ] Update `docs/README.md` with prominent links to both guides.
   - [ ] Update `packages/wesley-holmes/README.md` Additional Resources with the same links.

## Definition of Done

Guides merged, entry-point links updated, previews validated, and issue references (#192–#195) documented in changelog / closing comments.

## Scope

### In-Scope

- Authoring/illustrating guides
- Validating example workflows
- Updating README entry points

### Out-of-Scope

- Non-GitHub CI platforms (follow-up)
- HOLMES UI feature work

### Deliverables

- **Est. Lines of Code:** 350-500 (markdown + assets)
- **Est. Blast Radius:** docs/features/*, docs/assets/holmes, docs/README.md, packages/wesley-holmes/README.md

## Implementation Details

### High-Level Approach

Create draft outlines, validate workflows/screenshots, capture assets, then land README link updates alongside guide PRs to avoid broken references.

### Affected Areas

- docs/features/holmes-ci-cd.md (new)
- docs/features/holmes-dashboard.md (new or expanded)
- docs/assets/holmes/* (new images)
- docs/README.md
- packages/wesley-holmes/README.md

### Implementation Steps

- [ ] Draft both guides and circulate for HOLMES maintainer review.
- [ ] Capture screenshots/diagrams and store under docs/assets/holmes/.
- [ ] Update READMEs once guides merged to main.
- [ ] Run docs site locally (Astro) to confirm formatting and links.

## Test Plan

### Happy Path

- [ ] Sample GitHub Actions workflow executes successfully against a sandbox repo.
- [ ] Docs render with working intra-site links.

### Edge Cases

- [ ] Document forks/limited permissions in CI guide.
- [ ] Ensure images scale on mobile viewports.

### Failure Cases

- [ ] Provide troubleshooting section for failed HOLMES runs in CI guide.

### Monitoring & Success Metrics

- [ ] Optional: add TODO to measure page views/download hits post-launch (analytics backlog).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| GitHub Actions | Sample workflow | Author | pending | |
| Docs preview | Web | Docs | pending | |

## Requirements

### Hard Requirements

- Instructions align with current HOLMES CLI commands.
- Guides reference canonical configuration paths and version notes.

### Soft Requirements

- Include security considerations for secrets and report handling.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] HOLMES maintainers review terminology and workflow steps.

---

## Production Notes

### Priority: 4 / 5

High-leverage doc bundle for HOLMES adoption.

### Complexity: 3 / 5

Docs writing + asset validation + README touch-ups.

### Estimate: 12 - 16 hours

Includes drafting, testing workflows, capturing assets, and reviews.

### Risk & Rollback

- **Primary Risks:** Docs drift as HOLMES evolves.
- **Mitigations:** Capture version assumptions; schedule quarterly audit.
- **Rollback / Kill Switch:** Update or retire guides if workflows change significantly.
