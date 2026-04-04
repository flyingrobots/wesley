# GH-148 demo(sveltekit): RPC sample

- Imported from: GitHub issue
- Issue: #148
- URL: https://github.com/flyingrobots/wesley/issues/148
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:45Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Relies on SvelteKit adapter issue #140.

# [DEMO-148] demo(sveltekit): RPC sample

## Overview

Build a SvelteKit demo highlighting generated SvelteKit actions that call Wesley RPC functions end-to-end.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #140 (SvelteKit adapter)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory

## User Story

As a **SvelteKit developer**, I want **a Wesley RPC demo**, so that **I can see how generated actions integrate with SvelteKit apps**.

## Acceptance Criteria

- [ ] SvelteKit project demonstrating generated actions and RPC usage.
- [ ] Minimal UI fetching/mutating data via actions.
- [ ] README documenting setup (transform → plan → pnpm dev).
- [ ] Optional Playwright smoke test verifying page renders data.

## Definition of Done

Demo committed with docs, optional smoke instructions/tests, and references to adapter issue.

## Scope

### In-Scope

- SvelteKit project scaffolding
- Adapter integration
- Documentation & optional tests

### Out-of-Scope

- Production auth/complex flows

### Deliverables

- **Est. Lines of Code:** 450-600
- **Est. Blast Radius:** demos/sveltekit, docs

## Implementation Details

### High-Level Approach

Use generated actions to wrap Wesley RPC, build simple UI, optionally add Playwright smoke test.

### Affected Areas

- demos/sveltekit/
- docs/demos

### Implementation Steps

- [ ] Scaffold SvelteKit app.
- [ ] Integrate generated actions.
- [ ] Add UI + tests (optional).
- [ ] Document usage.

## Test Plan

### Happy Path

- [ ] Demo runs locally; page shows data.

### Edge Cases

- [ ] Document environment variables (DB DSN).

### Failure Cases

- [ ] Provide troubleshooting for pnpm/vite issues.

### Monitoring & Success Metrics

- [ ] Optional Playwright run in CI.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Node env | Demo app | TBD | pending | |

## Requirements

### Hard Requirements

- SvelteKit 2+ compatibility.

### Soft Requirements

- Include screenshot/GIF in README.

### Runtime Requirements

- Works with Postgres DSN.

### Dependencies & Approvals

- [ ] SvelteKit adapter (#140).

---

## Production Notes

### Priority: 2 / 5

Demo supporting adapter adoption.

### Complexity: 3 / 5

SvelteKit integration + docs.

### Estimate: 40 - 60 hours

Includes implementation, docs, optional tests.

### Risk & Rollback

- **Primary Risks:** Demo maintenance.
- **Mitigations:** Document status.
- **Rollback / Kill Switch:** Archive if unmaintained.
