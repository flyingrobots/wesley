# GH-149 demo(astro): RPC sample

- Imported from: GitHub issue
- Issue: #149
- URL: https://github.com/flyingrobots/wesley/issues/149
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:46Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with Astro adapter issue #141.

# [DEMO-149] demo(astro): RPC sample

## Overview

Create an Astro demo showcasing the Astro adapter and Wesley RPC pipeline.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #141 (Astro adapter)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory

## User Story

As an **Astro developer**, I want **a sample project using Wesley RPC**, so that **I can understand how the adapter integrates with Astro routes/components**.

## Acceptance Criteria

- [ ] Astro project with adapter integrated.
- [ ] Example page fetching data via Wesley RPC (API route/composable).
- [ ] README with setup/run instructions.
- [ ] Optional script to regenerate artifacts.

## Definition of Done

Demo added with documentation, optional smoke instructions, and references to adapter issue.

## Scope

### In-Scope

- Astro project scaffolding
- Adapter integration
- Docs

### Out-of-Scope

- Production deployment or advanced auth.

### Deliverables

- **Est. Lines of Code:** 350-500
- **Est. Blast Radius:** demos/astro, docs

## Implementation Details

### High-Level Approach

Use generated adapter to fetch data, expose via Astro component, provide sample requests.

### Affected Areas

- demos/astro/
- docs/demos

### Implementation Steps

- [ ] Scaffold Astro project.
- [ ] Integrate adapter + RPC call.
- [ ] Document usage.

## Test Plan

### Happy Path

- [ ] Demo runs (`npm run dev`), page displays data.

### Edge Cases

- [ ] Document environment variables if required.

### Failure Cases

- [ ] Provide troubleshooting for npm/adapter issues.

### Monitoring & Success Metrics

- [ ] Optional CI job (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Node env | Demo app | TBD | pending | |

## Requirements

### Hard Requirements

- Astro 4+.

### Soft Requirements

- Include screenshot/GIF in README.

### Runtime Requirements

- Works with Postgres backend (matching adapter).

### Dependencies & Approvals

- [ ] Astro adapter (#141).

---

## Production Notes

### Priority: 2 / 5

Demo for adapter validation.

### Complexity: 3 / 5

Astro integration + docs.

### Estimate: 32 - 48 hours

Includes implementation, docs.

### Risk & Rollback

- **Primary Risks:** Demo maintenance.
- **Mitigations:** Document status, mark as example.
- **Rollback / Kill Switch:** Archive if unmaintained.
