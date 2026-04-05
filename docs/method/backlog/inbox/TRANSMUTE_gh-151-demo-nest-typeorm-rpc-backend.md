# GH-151 demo(nest-typeorm): RPC backend

- Imported from: GitHub issue
- Issue: #151
- URL: https://github.com/flyingrobots/wesley/issues/151
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:49Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:future-generators`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with generator issue #143 for TypeORM output.

# [DEMO-151] demo(nest-typeorm): RPC backend

## Overview

Build a Nest.js + TypeORM demo showcasing Wesley-generated modules/entities and RPC integration.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #143 (TypeORM generator)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory

## User Story

As a **Nest.js developer**, I want **a demo using Wesley-generated TypeORM modules**, so that **I can see how RPC flows integrate with Nest**.

## Acceptance Criteria

- [ ] Nest.js app with generated TypeORM entities/modules.
- [ ] REST or GraphQL endpoints demonstrating RPC calls.
- [ ] README with setup/run/test instructions.
- [ ] Optional script to regenerate artifacts.

## Definition of Done

Demo added with documentation, optional smoke testing guidance, and references to generator issue.

## Scope

### In-Scope

- Nest.js project scaffolding
- Integration with generated artifacts
- Documentation

### Out-of-Scope

- Production deployment or advanced auth.

### Deliverables

- **Est. Lines of Code:** 600-800
- **Est. Blast Radius:** demos/nest-typeorm, docs

## Implementation Details

### High-Level Approach

Generate TypeORM entities via Wesley, set up Nest.js modules/services to use them, expose endpoints hitting RPC outputs, document usage.

### Affected Areas

- demos/nest-typeorm/
- docs/demos

### Implementation Steps

- [ ] Generate TypeORM artifacts.
- [ ] Scaffold Nest.js app.
- [ ] Implement endpoints calling RPC functions.
- [ ] Write README and usage examples.

## Test Plan

### Happy Path

- [ ] App builds and endpoints respond as expected.

### Edge Cases

- [ ] Document environment variables (DB DSN).

### Failure Cases

- [ ] Provide troubleshooting for Node/npm issues.

### Monitoring & Success Metrics

- [ ] Optional future CI job to build demo.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Node env | Demo app | TBD | pending | |

## Requirements

### Hard Requirements

- Target Node 20+.

### Soft Requirements

- Provide Postman/curl examples.

### Runtime Requirements

- Works with Postgres DSN.

### Dependencies & Approvals

- [ ] TypeORM generator (#143).

---

## Production Notes

### Priority: 2 / 5

Demo for future generator adoption.

### Complexity: 4 / 5

Nest integration + docs.

### Estimate: 60 - 80 hours

Includes implementation, docs.

### Risk & Rollback

- **Primary Risks:** Demo maintenance burden.
- **Mitigations:** Document status as example only.
- **Rollback / Kill Switch:** Archive if unmaintained.
