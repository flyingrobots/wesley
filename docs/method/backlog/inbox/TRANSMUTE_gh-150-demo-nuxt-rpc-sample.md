# GH-150 demo(nuxt): RPC sample

- Imported from: GitHub issue
- Issue: #150
- URL: https://github.com/flyingrobots/wesley/issues/150
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:48Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:frontend-adapters`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with adapter issue #142 for scaffolding.

# [DEMO-150] demo(nuxt): RPC sample

## Overview

Ship a Nuxt demo verifying the generated Nuxt adapter and Wesley RPC pipeline end-to-end.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #142 (Nuxt adapter)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory

## User Story

As a **Nuxt developer**, I want **a working Wesley RPC example**, so that **I can see how the adapter integrates with Nuxt server routes/composables**.

## Acceptance Criteria

- [ ] Nuxt app with generated adapter integrated.
- [ ] Page/component fetching data via Wesley RPC.
- [ ] README detailing setup/run.
- [ ] Optional script to regenerate artifacts.

## Definition of Done

Demo committed, documentation provided, optional smoke instructions included.

## Scope

### In-Scope

- Nuxt project scaffolding
- Adapter integration
- Docs

### Out-of-Scope

- Production deployment or auth flows

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** demos/nuxt, docs

## Implementation Details

### High-Level Approach

Use generated adapter to fetch data server-side, expose to UI, document sample requests.

### Affected Areas

- demos/nuxt/
- docs/demos

### Implementation Steps

- [ ] Scaffold Nuxt app.
- [ ] Integrate adapter + sample RPC call.
- [ ] Add docs and usage instructions.

## Test Plan

### Happy Path

- [ ] Demo runs locally; sample page loads data.

### Edge Cases

- [ ] Document env vars (API URLs/DSN).

### Failure Cases

- [ ] Provide troubleshooting for npm issues.

### Monitoring & Success Metrics

- [ ] Optional CI build (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Node env | Demo app | TBD | pending | |

## Requirements

### Hard Requirements

- Nuxt 3+ support.

### Soft Requirements

- Provide screenshot/GIF in README.

### Runtime Requirements

- Works with Postgres backend.

### Dependencies & Approvals

- [ ] Nuxt adapter (#142) delivered.

---

## Production Notes

### Priority: 2 / 5

Demo for adapter validation.

### Complexity: 3 / 5

Nuxt integration + docs.

### Estimate: 40 - 60 hours

Includes implementation, docs.

### Risk & Rollback

- **Primary Risks:** Demo rot.
- **Mitigations:** Document maintenance expectations.
- **Rollback / Kill Switch:** Archive if unmaintained.
