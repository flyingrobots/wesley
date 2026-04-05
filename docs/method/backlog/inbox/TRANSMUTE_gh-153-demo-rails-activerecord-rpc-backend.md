# GH-153 demo(rails): ActiveRecord RPC backend

- Imported from: GitHub issue
- Issue: #153
- URL: https://github.com/flyingrobots/wesley/issues/153
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:44:52Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:future-generators`, `group:demos`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Align with generator work #145 to ensure ActiveRecord artifacts available.

# [DEMO-153] demo(rails): ActiveRecord RPC backend

## Overview

Create a Rails demo using Wesley-generated ActiveRecord models/migrations to exercise RPC workflows.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #145 (ActiveRecord generator)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: demos directory structure

## User Story

As a **Rails developer**, I want **a demo showcasing Wesley-generated ActiveRecord schemas**, so that **I can see how RPC flows integrate with Rails apps**.

## Acceptance Criteria

- [ ] Rails app demonstrating generated models/migrations and RPC endpoints.
- [ ] README with setup/run commands (bundle exec, db setup).
- [ ] Sample requests or tests illustrating RPC usage.
- [ ] Optional script to regenerate artifacts via Wesley.

## Definition of Done

Demo committed with documentation, optional smoke test or instructions provided.

## Scope

### In-Scope

- Rails app scaffolding
- Integration with generated artifacts
- Documentation

### Out-of-Scope

- Production-grade deployment or UI

### Deliverables

- **Est. Lines of Code:** 600-800 (Rails app + docs)
- **Est. Blast Radius:** demos/rails, docs

## Implementation Details

### High-Level Approach

Generate ActiveRecord models with Wesley, set up Rails app with minimal controllers/services, expose RPC endpoints, document usage.

### Affected Areas

- demos/rails/
- docs/demos (new guide)

### Implementation Steps

- [ ] Generate models/migrations with Wesley.
- [ ] Scaffold Rails app and integrate.
- [ ] Implement sample controller or background job hitting RPC outputs.
- [ ] Document steps and sample curl/Postman requests.

## Test Plan

### Happy Path

- [ ] App boots, migrations run, sample RPC call works.

### Edge Cases

- [ ] Document environment variables (DB credentials).

### Failure Cases

- [ ] Provide troubleshooting tips for Rails-specific issues.

### Monitoring & Success Metrics

- [ ] Optional CI job ensures demo builds (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Local Rails env | Demo app | TBD | pending | |

## Requirements

### Hard Requirements

- Keep dependencies minimal; Rails 7+.

### Soft Requirements

- Provide script to regenerate Wesley artifacts.

### Runtime Requirements

- Works with Postgres (align with generator).

### Dependencies & Approvals

- [ ] ActiveRecord generator (#145) available.

---

## Production Notes

### Priority: 2 / 5

Demo for future generator adoption.

### Complexity: 4 / 5

Rails app integration + docs.

### Estimate: 60 - 80 hours

Includes scaffolding, integration, docs.

### Risk & Rollback

- **Primary Risks:** Demo bitrot.
- **Mitigations:** Document maintenance expectations.
- **Rollback / Kill Switch:** Archive demo if unmaintained.
