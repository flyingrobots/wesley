# GH-144 feat(generator): SQLAlchemy models

- Imported from: GitHub issue
- Issue: #144
- URL: https://github.com/flyingrobots/wesley/issues/144
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:28Z
- Lane: `inbox`
- Legend: `TRANSMUTE`
- Labels: `group:future-generators`

## Legend Fit

This issue primarily changes how Wesley maps source schemas into generated artifact families, adapters, or transmutations.

Trigger: title/label match: generators, adapters, QIR, RPC, ops, or artifact-domain expansion.

## Original Issue

---

## Additional Notes

Coordinate with demo issue #152 for validation.

# [GEN-144] feat(generator): SQLAlchemy models

## Overview

Generate SQLAlchemy declarative models and Alembic migration stubs from the Wesley IR to support Python teams.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #152 (Python demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: SQLAlchemy/Alembic docs, Wesley IR

## User Story

As a **Python developer**, I want **SQLAlchemy models/migrations generated from my GraphQL schema**, so that **I can use Wesley in Python projects**.

## Acceptance Criteria

- [ ] Generator produces SQLAlchemy models with relationships and metadata.
- [ ] Alembic migration scripts emitted per Wesley migration phases.
- [ ] Config manifest exposes SQLAlchemy target.
- [ ] Example project compiles/runs migrations using generated output.
- [ ] Documentation outlines integration steps.

## Definition of Done

Generator implemented, tests passing, docs updated, sample project validated.

## Scope

### In-Scope

- New generator module for SQLAlchemy/Alembic
- Tests verifying output
- Docs

### Out-of-Scope

- Demo app (#152)

### Deliverables

- **Est. Lines of Code:** 800-1100
- **Est. Blast Radius:** new generator package, docs, tests

## Implementation Details

### High-Level Approach

Map IR to SQLAlchemy declarative models, generate Alembic migration scripts aligned with expand/backfill/contract, integrate with config.

### Affected Areas

- packages/wesley-generator-sqlalchemy (new)
- Config/CLI integration
- Docs

### Implementation Steps

- [ ] Design model/migration mapping.
- [ ] Implement generator producing models + migrations.
- [ ] Integrate into config + CLI.
- [ ] Add tests and documentation.

## Test Plan

### Happy Path

- [ ] Generated project applies migrations and instantiates models.

### Edge Cases

- [ ] Complex relationships, enums, defaults.

### Failure Cases

- [ ] Unsupported directives raise clear errors.

### Monitoring & Success Metrics

- [ ] Optional future adoption metrics.

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Generator | TBD | pending | |
| Sample project | Demo validation | TBD | pending | |

## Requirements

### Hard Requirements

- Generated code matches SQLAlchemy best practices.

### Soft Requirements

- Provide guidance for customizing session/engine setup.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Input from Python practitioners for validation.

---

## Production Notes

### Priority: 3 / 5

Expands Wesley ecosystem.

### Complexity: 5 / 5

Full generator + migration strategy.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Schema mismatch, Alembic compatibility.
- **Mitigations:** Validate with sample project, document limitations.
- **Rollback / Kill Switch:** Mark generator experimental until stable.
