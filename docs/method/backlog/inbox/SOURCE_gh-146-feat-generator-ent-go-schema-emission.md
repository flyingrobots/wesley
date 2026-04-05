# GH-146 feat(generator): ent (Go) schema emission

- Imported from: GitHub issue
- Issue: #146
- URL: https://github.com/flyingrobots/wesley/issues/146
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:47:31Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `group:future-generators`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Collaborate with demo issue #154 to validate output.

# [GEN-146] feat(generator): ent (Go) schema emission

## Overview

Generate ent (Go) schema definitions and migrations from the Wesley IR to support Go services.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #154 (Go ent demo)
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: ent documentation, Wesley IR

## User Story

As a **Go developer**, I want **Wesley to emit ent schemas/migrations**, so that **I can use GraphQL as the source of truth for my Go backend**.

## Acceptance Criteria

- [ ] GraphQL → ent schema mapping implemented (fields, edges, annotations).
- [ ] Migrations emitted compatible with ent migration tooling.
- [ ] Config manifest exposes ent generator as optional target.
- [ ] Example Go project builds with generated ent schemas.
- [ ] Documentation added for ent integration.

## Definition of Done

Generator available, tests covering mapping/migrations, docs published, and sample project validated.

## Scope

### In-Scope

- New generator package or module for ent.
- Tests verifying schema + migration output.
- Documentation.

### Out-of-Scope

- Runtime demos (handled in #154).

### Deliverables

- **Est. Lines of Code:** 800-1100
- **Est. Blast Radius:** new generator package, tests, docs

## Implementation Details

### High-Level Approach

Translate IR tables/relations into ent schema definitions, generate Go files + migrations, integrate into Wesley generator pipeline with config flag.

### Affected Areas

- New generator module (packages/wesley-generator-ent)
- Host/runtime integration
- Docs/guides

### Implementation Steps

- [ ] Design schema mapping (types, ID handling, edges).
- [ ] Implement generator producing ent schemas + migrations.
- [ ] Integrate into config/CLI.
- [ ] Add tests and docs.

## Test Plan

### Happy Path

- [ ] Generated ent project compiles and migrations apply.

### Edge Cases

- [ ] Complex relationships, enums, default values.

### Failure Cases

- [ ] Unsupported directives produce clear errors.

### Monitoring & Success Metrics

- [ ] Optional adoption metrics (future).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | Generator | TBD | pending | |
| Sample Go build | Demo project | TBD | pending | |

## Requirements

### Hard Requirements

- Generated code follows ent conventions.

### Soft Requirements

- Provide guidance on customizing ent hooks.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Collaboration with Go/ent practitioners for validation.

---

## Production Notes

### Priority: 3 / 5

Expands Wesley platform reach.

### Complexity: 5 / 5

New generator + language mapping.

### Estimate: 120 - 160 hours

Includes design, implementation, tests, docs.

### Risk & Rollback

- **Primary Risks:** Schema mismatch or unsupported patterns.
- **Mitigations:** Start with limited scope, document limitations.
- **Rollback / Kill Switch:** Mark generator experimental until stable.
