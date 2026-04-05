# GH-145 feat(generator): ActiveRecord schema

- Imported from: GitHub issue
- Issue: #145
- URL: https://github.com/flyingrobots/wesley/issues/145
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:30Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `group:future-generators`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Coordinate with demo issue #153 for validation.

# [GEN-145] feat(generator): ActiveRecord schema

## Overview

Generate Ruby on Rails ActiveRecord models and phased migrations from the Wesley IR.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #153 (Rails demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: Rails migration best practices, Wesley IR

## User Story

As a **Rails developer**, I want **Wesley to emit ActiveRecord models and migrations**, so that **I can adopt schema-first workflows in Ruby projects**.

## Acceptance Criteria

- [ ] ActiveRecord generator produces model classes and phased migrations (expand/backfill/contract).
- [ ] Config manifest exposes ActiveRecord target.
- [ ] Example Rails app compiles and runs migrations using generated output.
- [ ] Documentation covers setup, RLS considerations, and limitations.

## Definition of Done

Generator implemented, tests passing, docs updated, and example project validated.

## Scope

### In-Scope

- New generator module for ActiveRecord
- Tests verifying output
- Documentation

### Out-of-Scope

- Demo app implementation (#153)

### Deliverables

- **Est. Lines of Code:** 800-1200
- **Est. Blast Radius:** generator package, docs, tests

## Implementation Details

### High-Level Approach

Map IR tables to model classes, generate migrations per phase, integrate with config; ensure naming conventions align with Rails.

### Affected Areas

- New generator package (packages/wesley-generator-activerecord)
- Config surface
- Docs

### Implementation Steps

- [ ] Design schema mapping (types, associations).
- [ ] Implement generator producing models/migrations.
- [ ] Add config options + tests.
- [ ] Document usage and limitations.

## Test Plan

### Happy Path

- [ ] Generated Rails app runs `bundle exec rails db:migrate` successfully.

### Edge Cases

- [ ] Polymorphic associations, enums, tenancy.

### Failure Cases

- [ ] Unsupported directives produce clear errors.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Generator | TBD | pending | |
| Sample Rails app | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Align with Rails naming/primary key conventions.

### Soft Requirements

- Provide customization hooks guidance.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Rails practitioners for validation.

---

## Production Notes

### Priority: 3 / 5

Expands Wesley to Ruby ecosystem.

### Complexity: 5 / 5

New language generator + phased migrations.

### Estimate: 120 - 160 hours

Includes mapping, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Migration mismatches, naming issues.
- **Mitigations:** Validate with demo app, document limitations.
- **Rollback / Kill Switch:** Mark generator experimental until mature.
