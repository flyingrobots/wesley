# GH-154 demo(go-ent): RPC backend

- Imported from: GitHub issue
- Issue: #154
- URL: https://github.com/flyingrobots/wesley/issues/154
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:54Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:future-generators`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with generator work (#146) to ensure ent schemas available.

# [DEMO-154] demo(go-ent): RPC backend

## Overview

Implement a Go demo using Wesley-generated ent schemas to exercise RPC flows end-to-end.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #146 (ent generator)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demo framework (existing demos directory)

## User Story

As a **developer evaluating Wesley**, I want **a Go ent demo illustrating RPC flows**, so that **I can see how generated ent types integrate with a backend**.

## Acceptance Criteria

- [ ] Demo application using Go (Fiber/Chi) invoking generated ent code.
- [ ] README with setup/run instructions.
- [ ] Example requests showing RPC usage.
- [ ] Automated smoke test or instructions for manual verification.

## Definition of Done

Demo committed under demos/ (or appropriate path), README complete, and optional CI job verifies it builds.

## Scope

### In-Scope

- Demo application setup
- Integration with generated ent schema/RPC
- Documentation

### Out-of-Scope

- Production-ready deployment infrastructure

### Deliverables

- **Est. Lines of Code:** 500-700 (demo code + docs)
- **Est. Blast Radius:** demos/ directory, possibly generator outputs

## Implementation Details

### High-Level Approach

Use generated ent models, set up Go service with sample endpoints calling Wesley RPC outputs, provide sample HTTP requests.

### Affected Areas

- demos/go-ent/ (new)
- Documentation under docs/demos

### Implementation Steps

- [ ] Generate ent schema via Wesley.
- [ ] Scaffold Go service.
- [ ] Wire RPC calls and add sample routes.
- [ ] Write README and optional tests.

## Test Plan

### Happy Path

- [ ] Demo builds and runs; sample requests succeed.

### Edge Cases

- [ ] Document handling of auth/tenancy if applicable.

### Failure Cases

- [ ] Provide troubleshooting tips for Go toolchain errors.

### Monitoring & Success Metrics

- [ ] Optional: add CI build for demo (future).

### QA Sign-off Matrix

| Environment  | Surface  | Owner | Status  | Notes |
| ------------ | -------- | ----- | ------- | ----- |
| Local Go env | Demo app | TBD   | pending |       |

## Requirements

### Hard Requirements

- Demo stays lightweight; minimal dependencies.

### Soft Requirements

- Provide Postman or curl examples.

### Runtime Requirements

- Works with Go 1.22+ (Specify).

### Dependencies & Approvals

- [ ] Generator team ensures ent output available (#146).

---

## Production Notes

### Priority: 2 / 5

Demo for future generator validation.

### Complexity: 3 / 5

Requires backend setup + docs.

### Estimate: 40 - 60 hours

Includes scaffolding, integration, docs.

### Risk & Rollback

- **Primary Risks:** Demo bitrot.
- **Mitigations:** Note maintenance expectations; treat as optional sample.
- **Rollback / Kill Switch:** Remove demo if unsupported.
