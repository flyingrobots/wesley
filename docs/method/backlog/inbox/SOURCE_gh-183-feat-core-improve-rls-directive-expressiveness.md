# GH-183 feat(core): improve RLS directive expressiveness

- Imported from: GitHub issue
- Issue: #183
- URL: https://github.com/flyingrobots/wesley/issues/183
- Imported on: 2026-04-04
- GitHub updated: 2026-03-18T14:45:04Z
- Lane: `inbox`
- Legend: `SOURCE`
- Labels: `feature`, `pkg:wesley-core`

## Legend Fit

This issue primarily changes source authority, schema semantics, parser or IR meaning, or canonical docs for those contracts.

Trigger: title match: schema semantics, parser/IR meaning, or canonical documentation contract.

## Original Issue

---

## Additional Notes

Reference `packages/wesley-core/TASKLIST.md` for existing RLS TODOs.

# [CORE-183] feat(core): improve RLS directive expressiveness

## Overview

Enhance the RLS directive system to support richer composition, cleaner SQL output, and better validation so policies remain maintainable and predictable.

## References & Assets

- [ ] Figma / Design: n/a
- [ ] Product Spec: n/a
- [x] Related Issues / PRs: #180 (JSDoc audit) for documentation alignment
- [ ] Feature Flags / Experiments: n/a
- [x] Other Assets: packages/wesley-core/TASKLIST.md, docs/features/row-level-security.md

## User Story

As a **developer defining RLS policies**, I want **expressive directives that compose cleanly**, so that **generated policies stay readable and accurate without manual SQL tweaks**.

## Acceptance Criteria

- [ ] Multiple `@rls` directives per table compose explicitly via AND/OR helpers.
- [ ] Helper constructs emitted instead of monolithic expression strings.
- [ ] `extractValue` (and related parsing) returns `null` when arguments missing, emitting evidence warnings instead of empty strings.
- [ ] Generated SQL formatting stabilised (consistent indentation/newlines).
- [ ] Tests covering new directive combinations and formatting.

## Definition of Done

RLS directives support composition, SQL output formatted consistently, tests/documentation updated, and TASKLIST items cleared.

## Scope

### In-Scope

- Directive parsing enhancements
- IR updates for composed policies
- SQL generator improvements
- Tests + docs

### Out-of-Scope

- New RLS directives beyond composition helper logic

### Deliverables

- **Est. Lines of Code:** 400-600
- **Est. Blast Radius:** `packages/wesley-core` (parser, IR), generator SQL output, tests

## Implementation Details

### High-Level Approach

Update directive registry to allow arrays, introduce composition data structures (AND/OR helpers), update SQL generator to leverage helpers, ensure formatting/whitespace consistent, and improve error handling for missing values.

### Affected Areas

- packages/wesley-core/src/domain/directives
- SQL emission modules for RLS
- Evidence/validation warnings
- Test fixtures covering RLS

### Implementation Steps

- [ ] Support multiple `@rls` directives and capture composition metadata.
- [ ] Implement helper functions for AND/OR composition.
- [ ] Update generator to output readable SQL with helpers.
- [ ] Adjust extractValue to return null + evidence warnings.
- [ ] Add unit/integration tests and update docs.

## Test Plan

### Happy Path

- [ ] Table with multiple RLS directives generates expected composed policies.

### Edge Cases

- [ ] Missing directive arguments produce warnings without empty strings.
- [ ] Nested compositions handled correctly.

### Failure Cases

- [ ] Invalid compositions (e.g., conflicting directives) trigger clear errors.

### Monitoring & Success Metrics

- [ ] n/a (library feature).

### QA Sign-off Matrix

| Environment | Surface | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| Unit tests | RLS parser/generator | TBD | pending | |

## Requirements

### Hard Requirements

- Backward compatibility with existing directives.
- Deterministic SQL formatting for snapshot comparison.

### Soft Requirements

- Document examples in RLS guide.

### Runtime Requirements

- n/a

### Dependencies & Approvals

- [ ] Core team review of new directive syntax.

---

## Production Notes

### Priority: 4 / 5

Important for RLS usability.

### Complexity: 4 / 5

Touches parsing, IR, SQL generation.

### Estimate: 60 - 80 hours

Includes implementation, docs, tests.

### Risk & Rollback

- **Primary Risks:** Breaking existing policies.
- **Mitigations:** Provide compatibility layer, guard behind feature flag during rollout.
- **Rollback / Kill Switch:** Toggle to legacy generator if necessary.
